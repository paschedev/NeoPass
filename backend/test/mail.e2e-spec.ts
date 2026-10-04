import { Job } from 'bullmq';
import request from 'supertest';
import { MailProcessor } from '../src/mail/mail.processor';
import { FreeTicketsEmailJob, MailService } from '../src/mail/mail.service';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { resendMock } from './mocks/resend';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type SentEmail = {
  from: string;
  subject: string;
  html: string;
  text: string;
  attachments?: { content: Buffer; contentId?: string }[];
};
type MailJob = [
  string,
  {
    to: string;
    tickets: {
      qrCode: string;
      eventStartDate?: string;
      venueName?: string | null;
      venueAddress?: string | null;
      venueCity?: string | null;
    }[];
  },
  { jobId?: string; attempts?: number },
];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const VENUE = {
  venueName: 'Niceto Club',
  venueAddress: 'Av. Niceto Vega 5510',
  venueCity: 'CABA',
};

describe('Mails', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  describe('envío', () => {
    it('el mail de entradas lleva cada QR como imagen inline y escapa los textos', async () => {
      await t.app
        .get(MailService)
        .sendTicketsEmail('ana@neopass.test', 'Ana <b>', [
          {
            id: 'ticket-1',
            qrCode: 'qr-secreto',
            eventName: '<script>alert(1)</script>',
            ticketTypeName: 'VIP & Co',
          },
        ]);

      const [email] = resendMock.send.mock.calls[0] as [SentEmail];
      expect(email.html).not.toContain('<script>');
      expect(email.html).toContain('&lt;script&gt;');
      expect(email.html).toContain('Ana &lt;b&gt;');
      expect(email.html).not.toContain('data:image');
      const [attachment] = email.attachments ?? [];
      expect(attachment.contentId).toBeTruthy();
      expect(email.html).toContain(`cid:${attachment.contentId}`);
      expect(attachment.content.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    });

    it('el mail de entradas sale desde entradas@ con el evento en el asunto, el botón a Mis entradas del sitio y versión en texto', async () => {
      await t.app.get(MailService).sendTicketsEmail('ana@neopass.test', 'Ana', [
        {
          id: 'ticket-1',
          qrCode: 'qr-secreto',
          eventName: 'Fiesta Bresh',
          ticketTypeName: 'General',
        },
      ]);

      const [email] = resendMock.send.mock.calls[0] as [SentEmail];
      expect(email.from).toContain('entradas@neopass.ar');
      expect(email.subject).toBe('Tu entrada para Fiesta Bresh');
      expect(email.html).toContain(
        'href="https://app.neopass.test/panel/tickets"',
      );
      expect(email.html).not.toContain('undefined');
      expect(email.text).toContain('https://app.neopass.test/panel/tickets');
    });

    it('el mail de QR free sale desde entradas@ con cada QR inline y el botón a la página del evento', async () => {
      await new MailProcessor(t.app.get(MailService)).process({
        id: 'job-1',
        name: 'send-free-tickets',
        data: {
          to: 'ana@neopass.test',
          name: null,
          organizerName: 'Martina',
          eventId: 'evento-1',
          validUntil: null,
          tickets: [
            {
              id: 'ticket-1',
              qrCode: 'qr-secreto',
              eventName: 'Fiesta Bresh',
              ticketTypeName: 'General',
            },
          ],
        },
      } as Job<FreeTicketsEmailJob>);

      const [email] = resendMock.send.mock.calls[0] as [SentEmail];
      expect(email.from).toContain('entradas@neopass.ar');
      expect(email.subject).toBe(
        'Martina te mandó una entrada para Fiesta Bresh',
      );
      expect(email.html).toContain(
        'href="https://app.neopass.test/eventos/evento-1"',
      );
      const [attachment] = email.attachments ?? [];
      expect(email.html).toContain(`cid:${attachment.contentId}`);
      expect(attachment.content.subarray(0, 4)).toEqual(PNG_SIGNATURE);
    });

    it('el mail de recuperación de contraseña sale desde soporte@ con el enlace y versión en texto', async () => {
      const resetLink = 'https://app.neopass.test/reset-password?token=abc';

      await t.app
        .get(MailService)
        .sendPasswordResetEmail('ana@neopass.test', 'Ana', resetLink);

      const [email] = resendMock.send.mock.calls[0] as [SentEmail];
      expect(email.from).toContain('soporte@neopass.ar');
      expect(email.subject).toBe('Restablecé tu contraseña de NeoPass');
      expect(email.html).toContain(`href="${resetLink}"`);
      expect(email.text).toContain(resetLink);
    });

    it('si Resend rechaza el envío, falla para que la cola lo reintente', async () => {
      resendMock.send.mockResolvedValueOnce({
        data: null,
        error: { name: 'application_error', message: 'Resend caído' },
      });

      await expect(
        t.app.get(MailService).sendTicketsEmail('ana@neopass.test', 'Ana', []),
      ).rejects.toThrow();
    });
  });

  describe('encolado', () => {
    function pay(paymentId: string, orderId: string, amount: number) {
      mercadoPagoMock.paymentGet.mockResolvedValueOnce({
        status: 'approved',
        external_reference: orderId,
        transaction_amount: amount,
      });
      return new PaymentsProcessor(t.app.get(PaymentsService)).process({
        name: 'process-payment',
        data: { paymentId },
      } as Job);
    }

    function mailJobs() {
      return t.queues.mail.add.mock.calls as MailJob[];
    }

    it('después de pagar se encola el mail con las entradas, con reintentos y una vez por orden', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity: 2,
      });

      await pay('pago-1', order.id, 2000);
      await pay('pago-1', order.id, 2000);

      const jobs = mailJobs();
      expect(jobs.length).toBeGreaterThan(0);
      for (const [name, data, options] of jobs) {
        expect(name).toBe('send-tickets');
        expect(data.to).toBe(buyer.email);
        expect(data.tickets).toHaveLength(2);
        expect(options.jobId).toBe(`tickets-${order.id}`);
        expect(options.attempts).toBeGreaterThan(1);
      }
    });

    it('el mail de una compra lleva la fecha y el lugar del evento', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      await t.prisma.event.update({ where: { id: event.id }, data: VENUE });
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, { user: buyer, ticketType });

      await pay('pago-1', order.id, 1000);

      const [[, data]] = mailJobs();
      expect(data.tickets).toHaveLength(1);
      expect(data.tickets[0]).toMatchObject({
        eventStartDate: event.startDate.toISOString(),
        ...VENUE,
      });
    });

    it('un pago que no se concreta no encola ningún mail', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, { user: buyer, ticketType });

      await pay('pago-1', order.id, 1);

      expect(t.queues.mail.add).not.toHaveBeenCalled();
    });

    it('el pedido de recuperación de contraseña se encola', async () => {
      const user = await createUser(t.prisma);

      await request(t.app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: user.email })
        .expect(201);

      const [[name, data, options]] = mailJobs();
      expect(name).toBe('send-password-reset');
      expect(data.to).toBe(user.email);
      expect(options.attempts).toBeGreaterThan(1);
    });

    it('quien recibe una entrada transferida recibe un mail con el QR nuevo, la fecha y el lugar del evento', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({ where: { id: event.id }, data: VENUE });
      const owner = await createUser(t.prisma);
      const order = await createOrder(t.prisma, {
        user: owner,
        ticketType,
        status: 'PAID',
      });
      const ticket = await createTicket(t.prisma, { order, ticketType });
      const recipient = await createUser(t.prisma);

      await request(t.app.getHttpServer())
        .post(`/tickets/${ticket.id}/transfer`)
        .set('Authorization', authHeader(t.app, owner))
        .send({ targetUserId: recipient.id })
        .expect(201);

      const saved = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      const [[name, data]] = mailJobs();
      expect(name).toBe('send-tickets');
      expect(data.to).toBe(recipient.email);
      expect(data.tickets.map((x) => x.qrCode)).toEqual([saved.qrCode]);
      expect(data.tickets[0]).toMatchObject({
        eventStartDate: event.startDate.toISOString(),
        ...VENUE,
      });
    });
  });
});
