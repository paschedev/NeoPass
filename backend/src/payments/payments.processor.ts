import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from './payments.service';

export interface PaymentNotificationJob {
  paymentId: string;
  mpUserId?: string;
}

@Processor('payments')
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }

  // Rethrows so BullMQ retries with the queue's backoff.
  async process(job: Job<PaymentNotificationJob>): Promise<void> {
    const { paymentId, mpUserId } = job.data;
    try {
      await this.paymentsService.processPaymentNotification(
        paymentId,
        mpUserId,
      );
    } catch (error) {
      this.logger.error(
        `Error processing webhook for payment ${paymentId}`,
        error,
      );
      throw error;
    }
  }
}
