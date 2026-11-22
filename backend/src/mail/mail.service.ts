import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { EmailCodePurpose } from '@prisma/client';
import { JobsOptions, Queue } from 'bullmq';
import { Resend } from 'resend';
import { SUPPORT_EMAIL, TICKETS_EMAIL } from './mail-addresses';
import { emailChangedEmail } from './templates/email-changed-email';
import { googleLinkedEmail } from './templates/google-linked-email';
import { emailCodeEmail } from './templates/email-code-email';
import { freeTicketsEmail } from './templates/free-tickets-email';
import { passwordResetEmail } from './templates/password-reset-email';
import { TicketForMail, ticketsEmail } from './templates/tickets-email';
import {
  renderTicketsPdf,
  ticketPdfPages,
  ticketsPdfFilename,
} from './tickets-pdf';

const TICKETS_SENDER = `NeoPass <${TICKETS_EMAIL}>`;
const SUPPORT_SENDER = `NeoPass <${SUPPORT_EMAIL}>`;

// A failed send is retried by BullMQ: 5 attempts, the last one ~15 min later.
const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
};

// BullMQ sends the jobs without a priority before any prioritized one, so
// every mail gets one (lower goes first, same priority by arrival). The
// mails someone is waiting for on screen skip the tickets of a sales peak.
const AWAITED_MAIL: JobsOptions = { ...MAIL_JOB_OPTIONS, priority: 1 };
const REGULAR_MAIL: JobsOptions = { ...MAIL_JOB_OPTIONS, priority: 2 };

export interface TicketsEmailJob {
  to: string;
  name: string;
  tickets: TicketForMail[];
}

export interface FreeTicketsEmailJob {
  to: string;
  name: string | null;
  organizerName: string;
  eventId: string;
  // ISO date; null when the tickets are valid for the whole event.
  validUntil: string | null;
  tickets: TicketForMail[];
}

export interface PasswordResetEmailJob {
  to: string;
  name: string;
  resetLink: string;
}

export interface EmailCodeJob {
  to: string;
  name: string;
  code: string;
  purpose: EmailCodePurpose;
}

// To the old email once the account switched: `newEmail` goes masked.
export interface EmailChangedJob {
  to: string;
  name: string;
  newEmail: string;
}

// To the account's email when a Google account is linked to it.
export interface GoogleLinkedJob {
  to: string;
  name: string;
}

@Injectable()
export class MailService {
  private resend: Resend;
  private readonly ticketsUrl: string;
  private readonly frontendUrl: string;
  private readonly logger = new Logger(MailService.name);

  constructor(
    config: ConfigService,
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {
    // RESEND_BASE_URL: the simulated Resend of a load test (never in production).
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'), {
      baseUrl: config.get<string>('RESEND_BASE_URL'),
    });
    this.frontendUrl = config.getOrThrow<string>('FRONTEND_URL');
    this.ticketsUrl = new URL('/panel/tickets', this.frontendUrl).toString();
  }

  // `jobId` makes it idempotent: queuing the same order twice sends one mail.
  async queueTicketsEmail(job: TicketsEmailJob, jobId?: string) {
    await this.mailQueue.add('send-tickets', job, {
      ...REGULAR_MAIL,
      jobId,
    });
  }

  async queueFreeTicketsEmail(job: FreeTicketsEmailJob, jobId: string) {
    await this.mailQueue.add('send-free-tickets', job, {
      ...REGULAR_MAIL,
      jobId,
    });
  }

  async queuePasswordResetEmail(job: PasswordResetEmailJob) {
    await this.mailQueue.add('send-password-reset', job, AWAITED_MAIL);
  }

  async queueEmailCode(job: EmailCodeJob) {
    await this.mailQueue.add('send-email-code', job, AWAITED_MAIL);
  }

  async queueEmailChangedNotice(job: EmailChangedJob) {
    await this.mailQueue.add('send-email-changed', job, REGULAR_MAIL);
  }

  async queueGoogleLinkedNotice(job: GoogleLinkedJob) {
    await this.mailQueue.add('send-google-linked', job, REGULAR_MAIL);
  }

  async sendTicketsEmail(to: string, name: string, tickets: TicketForMail[]) {
    await this.send({
      from: TICKETS_SENDER,
      to,
      ...ticketsEmail({ name, tickets, ticketsUrl: this.ticketsUrl }),
      attachments: await ticketsPdfAttachments(tickets, null),
    });
  }

  async sendFreeTicketsEmail({
    to,
    name,
    organizerName,
    eventId,
    validUntil,
    tickets,
  }: FreeTicketsEmailJob) {
    const eventUrl = new URL(`/eventos/${eventId}`, this.frontendUrl);
    await this.send({
      from: TICKETS_SENDER,
      to,
      ...freeTicketsEmail({
        name,
        organizerName,
        validUntil,
        tickets,
        eventUrl: eventUrl.toString(),
      }),
      attachments: await ticketsPdfAttachments(tickets, validUntil),
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      ...passwordResetEmail({ name, resetLink }),
    });
  }

  async sendEmailCode({ to, name, code, purpose }: EmailCodeJob) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      ...emailCodeEmail({ name, code, purpose }),
    });
  }

  async sendEmailChangedNotice({ to, name, newEmail }: EmailChangedJob) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      ...emailChangedEmail({ name, newEmail }),
    });
  }

  async sendGoogleLinkedNotice({ to, name }: GoogleLinkedJob) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      ...googleLinkedEmail({ name }),
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

// All the tickets of the mail in one PDF, one page each. The body carries no QR
// images: Gmail files mails with several of them under Promotions.
async function ticketsPdfAttachments(
  tickets: TicketForMail[],
  validUntil: string | null,
) {
  if (tickets.length === 0) return [];

  return [
    {
      filename: ticketsPdfFilename(tickets[0].eventName, tickets.length),
      content: await renderTicketsPdf(ticketPdfPages({ tickets, validUntil })),
      contentType: 'application/pdf',
    },
  ];
}
