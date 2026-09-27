import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BatchStatus } from '@prisma/client';

@Injectable()
export class BatchCronService {
  private readonly logger = new Logger(BatchCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleScheduledBatches() {
    this.logger.debug('Checking for scheduled ticket batches to publish...');

    try {
      const now = new Date();

      const updated = await this.prisma.ticketBatch.updateMany({
        where: {
          status: BatchStatus.SCHEDULED,
          publishAt: { lte: now },
        },
        data: {
          status: BatchStatus.PUBLISHED,
        },
      });

      if (updated.count > 0) {
        this.logger.log(`Auto-published ${updated.count} scheduled batches.`);
      }

      // 2. End PUBLISHED batches whose closeAt time has arrived
      const ended = await this.prisma.ticketBatch.updateMany({
        where: {
          status: BatchStatus.PUBLISHED,
          closeAt: { lte: now },
        },
        data: {
          status: BatchStatus.ENDED,
        },
      });

      if (ended.count > 0) {
        this.logger.log(`Auto-ended ${ended.count} published batches.`);
      }
    } catch (error) {
      this.logger.error('Error in batch status cron', error);
    }
  }
}
