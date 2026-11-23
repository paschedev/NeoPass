import {
  Injectable,
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { PaymentsService } from '../payments/payments.service';
import { isStockLimitError } from '../prisma/prisma-errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JobsOptions, Queue } from 'bullmq';
import { ScheduledTurns } from '../redis/scheduled-turns';
import { MAX_TICKETS_PER_ORDER } from './dto/create-order.dto';
import { buildCheckoutOrder } from './checkout-order';
import { adjustmentCapOf, feeAdjustmentFor } from './fee-adjustment';
import { Prisma } from '@prisma/client';
import { hasUsableMercadoPagoToken } from '../payments/mercadopago-token';
import { MercadoPagoTokenCipher } from '../payments/mercadopago-token-cipher';
import type { ExpireOrderJob } from './orders.processor';

// Time the buyer has to pay before the reservation is released.
const ORDER_PAYMENT_WINDOW_MS = 10 * 60 * 1000;

// A failed expiration (usually a busy database) is retried by BullMQ: 5
// attempts, the last one ~7.5 min after the first.
const EXPIRE_ORDER_JOB_OPTIONS: JobsOptions = {
  delay: ORDER_PAYMENT_WINDOW_MS,
  attempts: 5,
  backoff: { type: 'exponential', delay: 30_000 },
};

// The sweep only takes orders that expired at least this long ago: by then
// the expiration job had its turn with all its retries, so both don't compete
// for the same orders while the database is busy. An order whose job failed
// or was never queued goes back on sale ~20 min after the checkout.
const OVERDUE_MARGIN_MS = ORDER_PAYMENT_WINDOW_MS;
const SWEEP_PERIOD_MS = 60 * 1000;
// Orders per query and queries per sweep: up to 500 orders a minute.
const SWEEP_BATCH_SIZE = 50;
const SWEEP_MAX_BATCHES = 10;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private paymentsService: PaymentsService,
    private readonly mercadoPagoTokenCipher: MercadoPagoTokenCipher,
    @InjectQueue('orders') private ordersQueue: Queue,
    private readonly turns: ScheduledTurns,
  ) {}

  async createCheckoutSession(
    userId: string,
    items: { ticketTypeId: string; quantity: number }[],
    promoterId?: string,
  ) {
    const ticketCount = items.reduce((sum, item) => sum + item.quantity, 0);
    if (ticketCount > MAX_TICKETS_PER_ORDER) {
      throw new BadRequestException(
        `Podés comprar hasta ${MAX_TICKETS_PER_ORDER} entradas por orden`,
      );
    }

    const now = new Date();
    const checkout = buildCheckoutOrder(
      items,
      await this.ordersRepository.findTicketTypesForCheckout(
        items.map((item) => item.ticketTypeId),
      ),
      now,
    );

    // The organizer collects with their own Mercado Pago account; the
    // platform account never collects a sale, nor an expired token.
    const { organizer } = checkout.event;
    if (!hasUsableMercadoPagoToken(organizer, now)) {
      throw new ConflictException(
        'El organizador de este evento todavía no puede cobrar entradas.',
      );
    }
    const sellerToken = this.mercadoPagoTokenCipher.decrypt(
      organizer.mercadoPagoAccessToken,
    );

    // Only an accepted promoter of this event earns a commission; any other
    // id is dropped so a stale or foreign referral link doesn't block the sale.
    const promoter = promoterId
      ? await this.ordersRepository.findAcceptedPromoter(
          promoterId,
          checkout.event.id,
        )
      : null;

    // 1. Reserve the stock and create the order in PENDING
    // The sale also collects part of what the organizer owes NeoPass for
    // absorbing less than their half of Mercado Pago's fee in past sales.
    // Without a debt there's nothing to collect, and the purchase doesn't
    // wait for the organizer's other purchases. A debt that shows up during
    // this purchase is collected by the next one.
    const adjustmentCap = adjustmentCapOf(checkout.ticketAmount);
    const owesNeoPass = organizer.mercadoPagoFeeBalance.gt(0);
    let order: { id: string; marketplaceFee: Prisma.Decimal };
    try {
      order = await this.ordersRepository.createPendingOrder(
        {
          userId,
          ticketAmount: checkout.ticketAmount,
          serviceFee: checkout.serviceFee,
          marketplaceFee: checkout.marketplaceFee,
          totalAmount: checkout.totalAmount,
          promoterId: promoter?.id,
          expiresAt: new Date(now.getTime() + ORDER_PAYMENT_WINDOW_MS),
          items: checkout.orderItems,
          organizerId: organizer.id,
        },
        owesNeoPass
          ? (balance, reserved) =>
              feeAdjustmentFor(balance, reserved, adjustmentCap)
          : null,
      );
    } catch (error) {
      if (isStockLimitError(error)) {
        throw new ConflictException(
          'Se agotaron las entradas mientras procesábamos tu compra.',
        );
      }
      throw error;
    }

    // 2. Schedule expiration job (Queue doesn't hold the DB connection)
    const job: ExpireOrderJob = { orderId: order.id };
    await this.ordersQueue.add('expire-order', job, EXPIRE_ORDER_JOB_OPTIONS);

    // 3. Create Mercado Pago preference OUTSIDE the DB transaction to avoid blocking resources
    let initPoint = '';
    try {
      const res = await this.paymentsService.createPreference(
        order.id,
        checkout.mpItems,
        order.marketplaceFee.toNumber(),
        sellerToken,
      );
      initPoint = res.initPoint || '';
    } catch (error) {
      this.logger.error('Error creating preference:', error);

      // If external payment API fails, release the reservation right away
      await this.ordersRepository.releasePendingOrder(order.id, 'CANCELLED');

      throw new BadGatewayException(
        'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.',
      );
    }

    return { orderId: order.id, checkoutUrl: initPoint };
  }

  // The time to pay ran out: the order expires and its tickets go back on sale.
  async expireOrder(orderId: string) {
    const released = await this.ordersRepository.releasePendingOrder(
      orderId,
      'EXPIRED',
    );
    if (released) this.logger.log(`Expired order ${orderId} due to timeout`);
  }

  // Safety net for the expiration job. With several replicas, only one of
  // them sweeps each turn, and a slow sweep doesn't overlap the next one.
  @Cron(CronExpression.EVERY_MINUTE, { waitForCompletion: true })
  async handleOverdueOrders() {
    try {
      if (
        !(await this.turns.claim('release-overdue-orders', SWEEP_PERIOD_MS))
      ) {
        return;
      }
      await this.releaseOverdueOrders(new Date());
    } catch (error) {
      this.logger.error('Error releasing overdue orders', error);
    }
  }

  // Expires the PENDING orders whose expiration never happened (its job ran
  // out of attempts or was never queued), oldest first and in batches. An
  // order that fails stays for the next sweep, and a batch with failures ends
  // this one: the database is probably busy. The clock is a parameter so
  // tests can fix it.
  async releaseOverdueOrders(now: Date) {
    const expiredBefore = new Date(now.getTime() - OVERDUE_MARGIN_MS);
    let released = 0;
    for (let batch = 0; batch < SWEEP_MAX_BATCHES; batch++) {
      const orderIds =
        await this.ordersRepository.findPendingOrdersExpiredBefore(
          expiredBefore,
          SWEEP_BATCH_SIZE,
        );
      let failed = false;
      for (const orderId of orderIds) {
        try {
          if (
            await this.ordersRepository.releasePendingOrder(orderId, 'EXPIRED')
          ) {
            released++;
          }
        } catch (error) {
          failed = true;
          this.logger.error(`Error releasing overdue order ${orderId}`, error);
        }
      }
      if (failed || orderIds.length < SWEEP_BATCH_SIZE) break;
    }
    if (released > 0) {
      this.logger.warn(
        `Released ${released} overdue orders the expiration job missed`,
      );
    }
  }
}
