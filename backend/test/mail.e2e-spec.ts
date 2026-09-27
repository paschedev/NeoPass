import { Job } from 'bullmq';
import request from 'supertest';
import { MailService } from '../src/mail/mail.service';
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
  html: string;
  attachments?: { content: Buffer; contentId?: string }[];
};
type MailJob = [
  string,
  { to: string; tickets: { qrCode: string }[] },
  { jobId?: string; attempts?: number },
];

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

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

    it('quien recibe una entrada transferida recibe un mail con el QR nuevo', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma);
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
    });
  });
});
