import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BatchesCronService {
  private readonly logger = new Logger(BatchesCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  // The user requested EVERY_MINUTE
  @Cron(CronExpression.EVERY_MINUTE)
  async handleBatchStatuses() {
    this.logger.log('Running batch status check cron...');

    try {
      // 1. Publish SCHEDULED batches whose publishAt time has arrived
      const publishedResult = await this.prisma.ticketBatch.updateMany({
        where: {
          status: 'SCHEDULED',
          publishAt: { lte: new Date() },
        },
        data: {
          status: 'PUBLISHED',
        },
      });

      if (publishedResult.count > 0) {
        this.logger.log(
          `Published ${publishedResult.count} scheduled batches.`,
        );
      }

      // 2. End PUBLISHED batches whose closeAt time has arrived
      const endedResult = await this.prisma.ticketBatch.updateMany({
        where: {
          status: 'PUBLISHED',
          closeAt: { lte: new Date() },
        },
        data: {
          status: 'ENDED',
        },
      });

      if (endedResult.count > 0) {
        this.logger.log(`Ended ${endedResult.count} published batches.`);
      }
    } catch (error) {
      this.logger.error('Error running batch status cron', error);
    }
  }
}
