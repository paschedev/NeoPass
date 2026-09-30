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
    let order, mpItems, serviceFee, sellerToken;
    try {
      const result = await this.ordersRepository.createCheckoutOrderTransaction(
        userId,
        items,
        promoterId,
      );
      order = result.order;
      mpItems = result.mpItems;
      serviceFee = result.serviceFee;
      sellerToken = result.sellerToken;
    } catch (error) {
      if (isStockLimitError(error)) {
        throw new ConflictException(
          'Se agotaron las entradas mientras procesábamos tu compra.',
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
        sellerToken,
      );
      initPoint = res.initPoint || '';
    } catch (error) {
      this.logger.error('Error creating preference:', error);

      // If external payment API fails, rollback stock manually
      await this.ordersRepository.markOrderFailedAndRollbackStock(order.id);

      throw new BadGatewayException(
        'No pudimos conectar con Mercado Pago. Probá de nuevo en unos minutos.',
      );
    }

    return { orderId: order.id, checkoutUrl: initPoint };
  }
}
