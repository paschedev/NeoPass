import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PaymentsService } from './payments.service';

export interface PaymentNotificationJob {
  paymentId: string;
  mpUserId?: string;
}

export interface PaymentPartsCheckJob {
  orderId: string;
}

@Processor('payments')
export class PaymentsProcessor extends WorkerHost {
  private readonly logger = new Logger(PaymentsProcessor.name);

  constructor(private readonly paymentsService: PaymentsService) {
    super();
  }

  // Rethrows so BullMQ retries with the queue's backoff.
  async process(
    job: Job<PaymentNotificationJob | PaymentPartsCheckJob>,
  ): Promise<void> {
    if (job.name === 'check-payment-parts') {
      return this.checkPaymentParts(job as Job<PaymentPartsCheckJob>);
    }
    const { paymentId, mpUserId } = job.data as PaymentNotificationJob;
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

  private async checkPaymentParts(job: Job<PaymentPartsCheckJob>) {
    const { orderId } = job.data;
    try {
      await this.paymentsService.checkPaymentParts(orderId);
    } catch (error) {
      this.logger.error(
        `Error checking the payment parts of order ${orderId}`,
        error,
      );
      throw error;
    }
  }
}
