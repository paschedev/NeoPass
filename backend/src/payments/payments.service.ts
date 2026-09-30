import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { PaymentsRepository } from './repositories/payments.repository';
import { TicketsService } from '../tickets/tickets.service';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { isValidWebhookSignature } from './webhook-signature';
import { NotificationsService } from '../notifications/notifications.service';
import type { PaymentNotificationJob } from './payments.processor';

// 8 attempts, the last one about an hour after the notification.
const PAYMENT_JOB_OPTIONS: JobsOptions = {
  attempts: 8,
  backoff: { type: 'exponential', delay: 30_000 },
};

@Injectable()
export class PaymentsService {
  private client: MercadoPagoConfig;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private ticketsService: TicketsService,
    private readonly config: ConfigService,
    @InjectQueue('payments') private readonly paymentsQueue: Queue,
    private readonly notificationsService: NotificationsService,
  ) {
    this.client = new MercadoPagoConfig({
      accessToken: this.config.getOrThrow<string>('MERCADOPAGO_ACCESS_TOKEN'),
    });
  }

  async createPreference(
    orderId: string,
    items: any[],
    feeAmount: number,
    sellerToken: string,
  ) {
    // Marketplace: the sale is collected with the organizer's OAuth token and
    // NeoPass keeps its service fee through marketplace_fee.
    const preference = new Preference(
      new MercadoPagoConfig({ accessToken: sellerToken }),
    );

    try {
      const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
      const backendUrl = this.config.getOrThrow<string>('BACKEND_URL');
      const bodyParams: any = {
        items: items,
        external_reference: orderId,
        back_urls: {
          success: `${frontendUrl}/checkout/success`,
          failure: `${frontendUrl}/checkout/failure`,
          pending: `${frontendUrl}/checkout/pending`,
        },
        auto_return: 'approved',
        // Webhooks only: without source_news Mercado Pago also sends IPN
        // notifications, which carry no signature and get rejected.
        notification_url: `${backendUrl}/payments/webhook?source_news=webhooks`,
      };

      if (feeAmount > 0) {
        bodyParams.marketplace_fee = feeAmount;
      }

      // MP bloquea webhooks a localhost, lo omitimos en desarrollo local
      if (
        backendUrl.includes('localhost') ||
        backendUrl.includes('127.0.0.1')
      ) {
        delete bodyParams.notification_url;
      }

      const response = await preference.create({
        body: bodyParams,
      });

      return { initPoint: response.init_point };
    } catch (error) {
      this.logger.error('Error creating Mercado Pago preference', error);
      throw error;
    }
  }

  // Only checks the signature and queues the notification: Mercado Pago gets its
  // answer right away and the processing retries on its own if it fails.
  async enqueueNotification(notification: {
    signature?: string;
    requestId?: string;
    dataId?: string;
    type?: string;
    mpUserId?: string;
  }) {
    const isValid = isValidWebhookSignature({
      xSignature: notification.signature,
      xRequestId: notification.requestId,
      dataId: notification.dataId,
      secret: this.config.getOrThrow<string>('MERCADOPAGO_WEBHOOK_SECRET'),
    });
    if (!isValid) {
      this.logger.warn(
        `Rejected Mercado Pago webhook with an invalid signature (request ${notification.requestId})`,
      );
      throw new UnauthorizedException();
    }
    if (notification.type !== 'payment' || !notification.dataId) return;

    const job: PaymentNotificationJob = {
      paymentId: notification.dataId,
      mpUserId: notification.mpUserId,
    };
    await this.paymentsQueue.add('process-payment', job, PAYMENT_JOB_OPTIONS);
  }

  async processPaymentNotification(paymentId: string, mpUserId?: string) {
    // The payment lives in the seller's account: read it with the token of the
    // organizer that Mercado Pago names in the notification, if we know them.
    const sellerToken = mpUserId
      ? await this.paymentsRepository.findMercadoPagoTokenByUserId(mpUserId)
      : null;
    const client = sellerToken
      ? new MercadoPagoConfig({ accessToken: sellerToken })
      : this.client;

    const paymentData = await new Payment(client).get({ id: paymentId });
    if (paymentData.status !== 'approved') {
      return this.handleNotApprovedPayment(paymentId, paymentData);
    }

    const orderId = paymentData.external_reference;
    if (!orderId) {
      this.logger.warn(`Approved payment ${paymentId} has no order reference`);
      return;
    }

    const amount = paymentData.transaction_amount ?? 0;

    // Two passes: if an expiration (or another webhook) changes the order
    // between reading and paying it, the second pass sees the new status.
    for (let pass = 0; pass < 2; pass++) {
      if (await this.paymentsRepository.findPaymentByProviderId(paymentId)) {
        // Already paid: make sure the tickets mail is queued (a retry after a
        // failed enqueue lands here). Idempotent per order.
        return this.ticketsService.queueOrderTicketsEmail(orderId);
      }
      const order = await this.paymentsRepository.findOrderForPayment(orderId);
      if (!order) {
        this.logger.error(
          `Approved payment ${paymentId} references unknown order ${orderId}`,
        );
        return;
      }
      if (!sameAmount(amount, order.totalAmount)) {
        return this.reportPaymentIssue(order, paymentId, 'AMOUNT_MISMATCH', {
          amount,
        });
      }
      // A cancelled order can also have a payment: it was refunded.
      if (order.status === 'PAID' || order.payment) {
        return this.reportPaymentIssue(order, paymentId, 'DUPLICATE_PAYMENT');
      }

      try {
        const paid = await this.paymentsRepository.payOrderTransaction(
          orderId,
          order.status,
          { providerPaymentId: paymentId, amount },
          async (tx: Prisma.TransactionClient) => {
            await this.ticketsService.generateTicketsForOrder(orderId, tx);
          },
        );
        if (paid) {
          this.logger.log(
            `Order ${orderId} marked as PAID and tickets generated.`,
          );
          return this.ticketsService.queueOrderTicketsEmail(orderId);
        }
      } catch (error) {
        if (!isStockLimitError(error)) throw error;
        return this.reportPaymentIssue(order, paymentId, 'OUT_OF_STOCK');
      }
    }
    throw new Error(
      `Order ${orderId} kept changing while processing payment ${paymentId}`,
    );
  }

  // Leaves a trace of every payment that is not approved, and reverses the
  // order if the payment had paid it and was then refunded or charged back.
  private async handleNotApprovedPayment(
    paymentId: string,
    payment: MercadoPagoPayment,
  ) {
    this.logger.warn(
      `Payment ${paymentId} for order ${payment.external_reference ?? '-'} is ${payment.status} (${payment.status_detail ?? '-'})`,
    );
    if (
      !payment.status ||
      !REVERSED_PAYMENT_STATUSES.includes(payment.status)
    ) {
      return;
    }

    const orderId =
      await this.paymentsRepository.refundPaymentTransaction(paymentId);
    if (orderId) {
      this.logger.log(
        `Order ${orderId} cancelled and its tickets voided: payment ${paymentId} is ${payment.status}`,
      );
    }
  }

  // A payment Mercado Pago approved but that cannot be turned into tickets:
  // it is logged and the organizer gets a notification to refund it by hand.
  private async reportPaymentIssue(
    order: NonNullable<
      Awaited<ReturnType<PaymentsRepository['findOrderForPayment']>>
    >,
    paymentId: string,
    reason: PaymentIssueReason,
    details: Record<string, unknown> = {},
  ) {
    this.logger.error(
      `Payment ${paymentId} for order ${order.id} needs review: ${reason}`,
    );
    const event = order.orderItems[0]?.ticketType.event;
    if (!event) return;

    await this.notificationsService.create({
      userId: event.organizerId,
      type: 'SYSTEM',
      eventId: event.id,
      ...PAYMENT_ISSUE_MESSAGES[reason](paymentId),
      metadata: { reason, orderId: order.id, paymentId, ...details },
    });
  }
}

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>;

// Statuses that undo money Mercado Pago had approved.
const REVERSED_PAYMENT_STATUSES = ['refunded', 'charged_back', 'cancelled'];

type PaymentIssueReason =
  | 'AMOUNT_MISMATCH'
  | 'DUPLICATE_PAYMENT'
  | 'OUT_OF_STOCK';

const PAYMENT_ISSUE_MESSAGES: Record<
  PaymentIssueReason,
  (paymentId: string) => { title: string; message: string }
> = {
  AMOUNT_MISMATCH: (paymentId) => ({
    title: 'Pago con un monto distinto',
    message: `Mercado Pago aprobó el pago ${paymentId} por un monto distinto al de la orden. No se emitieron entradas: revisalo y reembolsalo si corresponde.`,
  }),
  DUPLICATE_PAYMENT: (paymentId) => ({
    title: 'Pago duplicado',
    message: `La orden ya tenía un pago registrado y Mercado Pago aprobó otro (${paymentId}). No se emitieron entradas nuevas: reembolsalo desde tu cuenta de Mercado Pago.`,
  }),
  OUT_OF_STOCK: (paymentId) => ({
    title: 'Pago sin entradas disponibles',
    message: `Llegó el pago ${paymentId} de una orden vencida y ya no quedan entradas. No se emitieron entradas: reembolsalo desde tu cuenta de Mercado Pago.`,
  }),
};

// Mercado Pago reports the amount as a float: compare at cent precision.
function sameAmount(amount: number, total: Prisma.Decimal) {
  return new Prisma.Decimal(amount)
    .toDecimalPlaces(2)
    .equals(total.toDecimalPlaces(2));
}

function isStockLimitError(error: unknown) {
  return error instanceof Error && error.message.includes('check_stock_limits');
}
