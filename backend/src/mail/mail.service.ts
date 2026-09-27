import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { JobsOptions, Queue } from 'bullmq';
import * as qrcode from 'qrcode';
import { Resend } from 'resend';
import { escapeHtml } from './escape-html';

// Must be a domain verified in Resend, otherwise every send is rejected.
const MAIL_DOMAIN = 'neopass.ar';
const TICKETS_SENDER = `NeoPass <entradas@${MAIL_DOMAIN}>`;
const SUPPORT_SENDER = `NeoPass <soporte@${MAIL_DOMAIN}>`;

// A failed send is retried by BullMQ: 5 attempts, the last one ~15 min later.
const MAIL_JOB_OPTIONS: JobsOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: 60_000 },
};

export interface TicketForMail {
  id: string;
  qrCode: string;
  eventName: string;
  ticketTypeName: string;
}

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
  private readonly logger = new Logger(MailService.name);

  constructor(
    config: ConfigService,
    @InjectQueue('mail') private readonly mailQueue: Queue,
  ) {
    this.resend = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
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

  // The QR goes as an inline image (CID): Gmail blocks `data:` images.
  async sendTicketsEmail(to: string, name: string, tickets: TicketForMail[]) {
    const attachments = await Promise.all(
      tickets.map(async (ticket) => ({
        filename: `entrada-${ticket.id}.png`,
        content: await qrcode.toBuffer(ticket.qrCode, { width: 440 }),
        contentType: 'image/png',
        contentId: `qr-${ticket.id}`,
      })),
    );

    const ticketsHtml = tickets
      .map(
        (ticket) => `
        <div style="border: 1px solid #e5e5e5; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
          <h2 style="font-size: 18px; margin: 0 0 4px;">${escapeHtml(ticket.eventName)}</h2>
          <p style="margin: 0 0 12px; color: #555;">${escapeHtml(ticket.ticketTypeName)}</p>
          <img src="cid:qr-${ticket.id}" alt="Código QR de tu entrada" width="220" height="220" />
        </div>`,
      )
      .join('');

    await this.send({
      from: TICKETS_SENDER,
      to,
      subject: '¡Tus entradas están listas!',
      html: layout(`
        <h1 style="font-size: 22px;">¡Hola, ${escapeHtml(name)}!</h1>
        <p>Estas son tus entradas. Mostrá cada QR en la puerta: sirve para una sola persona.</p>
        ${ticketsHtml}
        <p style="color: #555; font-size: 13px;">No compartas estos códigos: quien tenga el QR entra con tu entrada. Si querés pasarle una entrada a alguien, usá "Transferir" en Mis entradas.</p>
      `),
      attachments,
    });
  }

  async sendPasswordResetEmail(to: string, name: string, resetLink: string) {
    await this.send({
      from: SUPPORT_SENDER,
      to,
      subject: 'Recuperación de contraseña - NeoPass',
      html: layout(`
        <h1 style="font-size: 22px;">Hola, ${escapeHtml(name)}</h1>
        <p>Pediste restablecer tu contraseña. Tocá el botón para crear una nueva:</p>
        <p style="text-align: center; margin: 24px 0;">
          <a href="${escapeHtml(resetLink)}" style="background: #4f46e5; color: #fff; padding: 12px 24px; border-radius: 999px; text-decoration: none; font-weight: bold;">Restablecer mi contraseña</a>
        </p>
        <p style="color: #555; font-size: 13px;">El enlace vence en 1 hora. Si no lo pediste, ignorá este mail.</p>
      `),
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

function layout(content: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111;">
      ${content}
      <p>El equipo de NeoPass</p>
    </div>`;
}
