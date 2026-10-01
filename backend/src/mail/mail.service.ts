import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import * as qrcode from 'qrcode';
import { Resend } from 'resend';
import { SUPPORT_EMAIL, TICKETS_EMAIL } from './mail-addresses';
import { passwordResetEmail } from './templates/password-reset-email';
import {
  qrContentId,
  TicketForMail,
  ticketsEmail,
} from './templates/tickets-email';

const TICKETS_SENDER = `NeoPass <${TICKETS_EMAIL}>`;
const SUPPORT_SENDER = `NeoPass <${SUPPORT_EMAIL}>`;

// A failed send is retried by BullMQ: 5 attempts, the last one ~15 min later.
const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
};

export interface TicketsEmailJob {
  to: string;
  name: string;
  tickets: TicketForMail[];
}

export interface PasswordResetEmailJob {
  to: string;
  name: string;
  resetLink: string;
}

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly ticketsUrl: string;
  private readonly logger = new Logger(MailService.name);

  constructor(
    config: ConfigService,
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.ticketsUrl = new URL(
      '/panel/tickets',
      config.getOrThrow<string>('FRONTEND_URL'),
    ).toString();
  }

  // `jobId` makes it idempotent: queuing the same order twice sends one mail.
  async queueTicketsEmail(job: TicketsEmailJob, jobId?: string) {
    await this.mailQueue.add('send-tickets', job, {
      ...MAIL_JOB_OPTIONS,
      jobId,
    });
  }

  async queuePasswordResetEmail(job: PasswordResetEmailJob) {
    await this.mailQueue.add('send-password-reset', job, MAIL_JOB_OPTIONS);
  }

  async sendTicketsEmail(to: string, name: string, tickets: TicketForMail[]) {
    const attachments = await Promise.all(
      tickets.map(async (ticket) => ({
        filename: `entrada-${ticket.id}.png`,
        content: await qrcode.toBuffer(ticket.qrCode, { width: 440 }),
        contentType: 'image/png',
        contentId: qrContentId(ticket.id),
      })),
    );

    await this.send({
      from: TICKETS_SENDER,
      to,
      ...ticketsEmail({ name, tickets, ticketsUrl: this.ticketsUrl }),
      attachments,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      ...passwordResetEmail({ name, resetLink }),
    });
  }

  // Throws on failure so the mail processor fails the job and BullMQ retries.
  private async send(email: Parameters<Resend['emails']['send']>[0]) {
    const { data, error } = await this.resend.emails.send(email);
    if (error) {
      throw new Error(`Resend rejected the email: ${error.message}`);
    }
    this.logger.log(`Email "${email.subject}" sent with ID ${data?.id}`);
  }
}
