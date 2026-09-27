import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { OrdersRepository } from './repositories/orders.repository';
import { PaymentsService } from '../payments/payments.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MAX_TICKETS_PER_ORDER } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly ordersRepository: OrdersRepository,
    private paymentsService: PaymentsService,
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

    // 1. Transaction to reserve stock and create order in PENDING status
    let order, mpItems, serviceFee, organizer;
    try {
      const result = await this.ordersRepository.createCheckoutOrderTransaction(
        userId,
        items,
        promoterId,
      );
      order = result.order;
      mpItems = result.mpItems;
      serviceFee = result.serviceFee;
      organizer = result.organizer;
    } catch (error: any) {
      if (
        error.code === 'P2010' ||
        error.message?.includes('check_stock_limits')
      ) {
        throw new BadRequestException(
          'Se agotaron las entradas mientras procesabamos tu compra.',
        );
      }
      throw error;
    }

    // 2. Schedule expiration job (Queue doesn't hold the DB connection)
    await this.ordersQueue.add(
      'expire-order',
      { orderId: order.id },
      { delay: 10 * 60 * 1000 },
    );

    // 3. Create Mercado Pago preference OUTSIDE the DB transaction to avoid blocking resources
    let initPoint = '';
    try {
      const res = await this.paymentsService.createPreference(
        order.id,
        mpItems,
        serviceFee.toNumber(),
        organizer.mercadoPagoAccessToken || undefined,
      );
      initPoint = res.initPoint || '';
    } catch (error) {
      this.logger.error('Error creating preference:', error);

      // If external payment API fails, rollback stock manually
      await this.ordersRepository.markOrderFailedAndRollbackStock(order.id);

      throw new BadRequestException(
        'Fallo de conexión con Mercado Pago. Es posible que el token del organizador sea inválido o haya caducado.',
      );
    }

    return { orderId: order.id, checkoutUrl: initPoint };
  }
}
