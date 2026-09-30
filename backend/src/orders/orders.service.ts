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
import { Queue } from 'bullmq';
import { MAX_TICKETS_PER_ORDER } from './dto/create-order.dto';
import { buildCheckoutOrder } from './checkout-order';
import { hasUsableMercadoPagoToken } from '../payments/mercadopago-token';
import { MercadoPagoTokenCipher } from '../payments/mercadopago-token-cipher';
import type { ExpireOrderJob } from './orders.processor';

// Time the buyer has to pay before the reservation is released.
const ORDER_PAYMENT_WINDOW_MS = 10 * 60 * 1000;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private paymentsService: PaymentsService,
    private readonly mercadoPagoTokenCipher: MercadoPagoTokenCipher,
    @InjectQueue('orders') private ordersQueue: Queue,
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
    let order: { id: string };
    try {
      order = await this.ordersRepository.createPendingOrder({
        userId,
        ticketAmount: checkout.ticketAmount,
        serviceFee: checkout.serviceFee,
        totalAmount: checkout.totalAmount,
        promoterId: promoter?.id,
        expiresAt: new Date(now.getTime() + ORDER_PAYMENT_WINDOW_MS),
        items: checkout.orderItems,
      });
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
    await this.ordersQueue.add('expire-order', job, {
      delay: ORDER_PAYMENT_WINDOW_MS,
    });

    // 3. Create Mercado Pago preference OUTSIDE the DB transaction to avoid blocking resources
    let initPoint = '';
    try {
      const res = await this.paymentsService.createPreference(
        order.id,
        checkout.mpItems,
        checkout.serviceFee.toNumber(),
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
}
