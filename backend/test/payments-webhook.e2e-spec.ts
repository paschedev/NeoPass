import { Job } from 'bullmq';
import request from 'supertest';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { testEnv } from './setup/test-env';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { signWebhook } from './utils/mercadopago-webhook';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const SELLER_MP_USER_ID = '555000';

describe('Webhook de Mercado Pago', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function notify(
    paymentId: string,
    { type = 'payment', signature = signWebhook(paymentId, 'req-1') } = {},
  ) {
    const req = request(t.app.getHttpServer())
      .post('/payments/webhook')
      .query({ 'data.id': paymentId, type })
      .set('x-request-id', 'req-1');
    if (signature) req.set('x-signature', signature);
    return req.send({
      type,
      action: 'payment.updated',
      user_id: Number(SELLER_MP_USER_ID),
      data: { id: paymentId },
    });
  }

  describe('entrada', () => {
    it('una notificación firmada se encola y responde 200', async () => {
      await notify('987654').expect(200);

      expect(t.queues.payments.add).toHaveBeenCalledTimes(1);
      const [name, data, options] = t.queues.payments.add.mock.calls[0] as [
        string,
        unknown,
        { attempts: number; backoff: unknown },
      ];
      expect(name).toBe('process-payment');
      expect(data).toEqual({
        paymentId: '987654',
        mpUserId: SELLER_MP_USER_ID,
      });
      expect(options.attempts).toBeGreaterThan(1);
      expect(options.backoff).toBeDefined();
    });

    it('una firma inválida responde 401 y no encola nada', async () => {
      await notify('987654', {
        signature: signWebhook('987654', 'req-1', 'otra-clave'),
      }).expect(401);

      expect(t.queues.payments.add).not.toHaveBeenCalled();
    });

    it('una notificación sin firma responde 401 y no encola nada', async () => {
      await notify('987654', { signature: '' }).expect(401);

      expect(t.queues.payments.add).not.toHaveBeenCalled();
    });

    it('una notificación firmada que no es de pagos se ignora', async () => {
      await notify('987654', { type: 'merchant_order' }).expect(200);

      expect(t.queues.payments.add).not.toHaveBeenCalled();
    });
  });

  describe('procesamiento', () => {
    function processPayment(paymentId: string, mpUserId?: string) {
      const processor = new PaymentsProcessor(t.app.get(PaymentsService));
      return processor.process({
        name: 'process-payment',
        data: { paymentId, mpUserId },
      } as Job);
    }

    async function pendingOrder() {
      const { organizer, ticketType } = await createOrganizerWithEvent(
        t.prisma,
        { price: 1000 },
      );
      await t.prisma.user.update({
        where: { id: organizer.id },
        data: { mercadoPagoUserId: SELLER_MP_USER_ID },
      });
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity: 2,
      });
      return { organizer, order };
    }

    it('un pago aprobado marca la orden como pagada y genera los tickets', async () => {
      const { organizer, order } = await pendingOrder();
      mercadoPagoMock.paymentGet.mockResolvedValueOnce({
        status: 'approved',
        external_reference: order.id,
        transaction_amount: 2000,
      });

      await processPayment('987654', SELLER_MP_USER_ID);

      expect(mercadoPagoMock.paymentGet).toHaveBeenCalledWith(
        { id: '987654' },
        organizer.mercadoPagoAccessToken,
      );
      const paid = await t.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(paid.status).toBe('PAID');
      expect(
        await t.prisma.ticket.count({ where: { orderId: order.id } }),
      ).toBe(2);
    });

    it('si el vendedor no es un organizador conocido, consulta con el token de la plataforma', async () => {
      await pendingOrder();
      mercadoPagoMock.paymentGet.mockResolvedValueOnce({ status: 'pending' });

      await processPayment('987654', '111222');

      expect(mercadoPagoMock.paymentGet).toHaveBeenCalledWith(
        { id: '987654' },
        testEnv.MERCADOPAGO_ACCESS_TOKEN,
      );
    });

    it('si Mercado Pago falla, el job falla para que BullMQ lo reintente', async () => {
      const { order } = await pendingOrder();
      mercadoPagoMock.paymentGet.mockRejectedValueOnce(
        new Error('MP no disponible'),
      );

      await expect(
        processPayment('987654', SELLER_MP_USER_ID),
      ).rejects.toThrow();

      const stillPending = await t.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(stillPending.status).toBe('PENDING');
    });
  });
});
