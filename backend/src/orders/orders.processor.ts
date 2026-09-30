import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { OrdersService } from './orders.service';

export type ExpireOrderJob = { orderId: string };

@Processor('orders')
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(private readonly ordersService: OrdersService) {
    super();
  }

  async process(job: Job<ExpireOrderJob>) {
    if (job.name !== 'expire-order') return;

    const { orderId } = job.data;
    try {
      await this.ordersService.expireOrder(orderId);
    } catch (error) {
      this.logger.error(`Error expiring order ${orderId}`, error);
      throw error;
    }
  }
}
