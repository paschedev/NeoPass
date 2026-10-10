import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  EmailChangedJob,
  EmailCodeJob,
  FreeTicketsEmailJob,
  MailService,
  PasswordResetEmailJob,
  TicketsEmailJob,
} from './mail.service';

@Processor('mail')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private mailService: MailService) {
    super();
  }

  // Errors propagate: BullMQ retries the job with the options it was queued with.
  async process(
    job: Job<
      | TicketsEmailJob
      | FreeTicketsEmailJob
      | PasswordResetEmailJob
      | EmailCodeJob
      | EmailChangedJob
    >,
  ) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'send-tickets': {
        const { to, name, tickets } = job.data as TicketsEmailJob;
        await this.mailService.sendTicketsEmail(to, name, tickets);
        break;
      }
      case 'send-free-tickets': {
        await this.mailService.sendFreeTicketsEmail(
          job.data as FreeTicketsEmailJob,
        );
        break;
      }
      case 'send-password-reset': {
        const { to, name, resetLink } = job.data as PasswordResetEmailJob;
        await this.mailService.sendPasswordResetEmail(to, name, resetLink);
        break;
      }
      case 'send-email-code': {
        await this.mailService.sendEmailCode(job.data as EmailCodeJob);
        break;
      }
      case 'send-email-changed': {
        await this.mailService.sendEmailChangedNotice(
          job.data as EmailChangedJob,
        );
        break;
      }
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
