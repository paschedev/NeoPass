import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Processor('orders')
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'expire-order') {
      const { orderId } = job.data;

      try {
        await this.prisma.$transaction(async (tx) => {
          // Conditional on PENDING: a payment or a concurrent job that already
          // moved the order makes this a no-op, so the reservation is released once.
          const { count } = await tx.order.updateMany({
            where: { id: orderId, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          if (count === 0) return;

          this.logger.log(`Expiring order ${orderId} due to timeout`);
          const items = await tx.orderItem.findMany({ where: { orderId } });
          for (const item of items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: {
                reserved: { decrement: item.quantity },
              },
            });
          }
        });
      } catch (error) {
        this.logger.error(`Error expiring order ${orderId}`, error);
        throw error;
      }
    }
  }
}
