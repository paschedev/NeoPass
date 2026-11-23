import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import {
  EmailChangedJob,
  GoogleLinkedJob,
  EmailCodeJob,
  FreeTicketsEmailJob,
  MailService,
  PasswordResetEmailJob,
  TicketsEmailJob,
} from './mail.service';

type MailJob = Job<
  | TicketsEmailJob
  | FreeTicketsEmailJob
  | PasswordResetEmailJob
  | EmailCodeJob
  | EmailChangedJob
  | GoogleLinkedJob
>;

// Several sends at once, capped for the whole queue (every replica counts)
// below Resend's limit of 10 requests per second per team: one every 125 ms
// is 8 per second. The limiter counts in fixed windows, so 8 per 1000 ms
// would let up to twice that start within a second around a window's edge.
@Processor('mail', { concurrency: 5, limiter: { max: 1, duration: 125 } })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private mailService: MailService) {
    super();
  }

  // Errors propagate: BullMQ retries the job with the options it was queued with.
  async process(job: MailJob) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    try {
      await this.send(job);
    } catch (error) {
      this.logFailure(job, error);
      throw error;
    }
  }

  // Every failed send leaves a trace with the mail type and the attempt, never
  // the recipient or the content. After the last attempt the mail is lost, so
  // that one is an error.
  private logFailure(job: MailJob, error: unknown) {
    const attempt = job.attemptsMade + 1;
    const attempts = job.opts.attempts ?? 1;
    const reason = error instanceof Error ? error.message : String(error);
    const message = `Mail job ${job.id} of type ${job.name} failed on attempt ${attempt} of ${attempts}: ${reason}`;
    if (attempt >= attempts) this.logger.error(message);
    else this.logger.warn(message);
  }

  private async send(job: MailJob) {
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
      case 'send-google-linked': {
        await this.mailService.sendGoogleLinkedNotice(
          job.data as GoogleLinkedJob,
        );
        break;
      }
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
