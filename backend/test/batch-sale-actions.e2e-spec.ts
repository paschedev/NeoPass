import { Job } from 'bullmq';
import request from 'supertest';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

const fromNow = (ms: number) => new Date(Date.now() + ms);

type Created = Awaited<ReturnType<typeof createOrganizerWithEvent>>;
type User = Parameters<typeof authHeader>[1];

describe('Acciones de venta de una tanda', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mockTurnstile(true);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
  });

  afterAll(() => t.close());

  // Empezó hace una hora y termina en tres.
  async function eventInProgress(batch = {}) {
    const created = await createOrganizerWithEvent(t.prisma, { batch });
    const event = await t.prisma.event.update({
      where: { id: created.event.id },
      data: { startDate: fromNow(-HOUR_MS), endDate: fromNow(3 * HOUR_MS) },
    });
    return { ...created, event };
  }

  function act(user: User, eventId: string, batchId: string, action: unknown) {
    return request(t.app.getHttpServer())
      .put(`/events/${eventId}/batches/${batchId}/sale`)
      .set('Authorization', authHeader(t.app, user))
      .send({ action });
  }

  const actOn = ({ organizer, event, batch }: Created, action: string) =>
    act(organizer, event.id, batch.id, action);

  async function checkoutStatus(ticketTypeId: string) {
    mockTurnstile(true);
    const buyer = await createUser(t.prisma);
    const res = await request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId, quantity: 1 }],
      });
    return res.status;
  }

  async function publicBatchNames(eventId: string) {
    const res = await request(t.app.getHttpServer())
      .get(`/events/${eventId}`)
      .expect(200);
    return (
      res.body as { ticketBatches: { name: string }[] }
    ).ticketBatches.map(({ name }) => name);
  }

  function savedBatch(id: string) {
    return t.prisma.ticketBatch.findUniqueOrThrow({ where: { id } });
  }

  describe('con el evento en curso', () => {
    it('finalizar la venta corta las compras nuevas de esa tanda al instante', async () => {
      const created = await eventInProgress();

      const res = await actOn(created, 'END').expect(200);

      expect(res.body).toEqual({
        id: created.batch.id,
        isVisible: true,
        publishAt: null,
        closeAt: expect.any(String) as string,
      });
      expect(await checkoutStatus(created.ticketType.id)).toBe(409);
      expect(await publicBatchNames(created.event.id)).toEqual([]);
    });

    it('la hora del fin de venta la pone el servidor, no quien la pide', async () => {
      const created = await eventInProgress();
      const before = Date.now();

      await request(t.app.getHttpServer())
        .put(`/events/${created.event.id}/batches/${created.batch.id}/sale`)
        .set('Authorization', authHeader(t.app, created.organizer))
        .send({ action: 'END', closeAt: fromNow(2 * HOUR_MS).toISOString() })
        .expect(200);

      const { closeAt } = await savedBatch(created.batch.id);
      expect(closeAt!.getTime()).toBeGreaterThanOrEqual(before);
      expect(closeAt!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('quien ya estaba pagando termina su compra y recibe sus entradas', async () => {
      const created = await eventInProgress();
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType: created.ticketType,
        quantity: 2,
      });

      await actOn(created, 'END').expect(200);
      mercadoPagoMock.paymentGet.mockResolvedValueOnce({
        status: 'approved',
        external_reference: order.id,
        transaction_amount: 2000,
      });
      await new PaymentsProcessor(t.app.get(PaymentsService)).process({
        name: 'process-payment',
        data: { paymentId: 'pago-1' },
      } as Job);

      const paid = await t.prisma.order.findUniqueOrThrow({
        where: { id: order.id },
      });
      expect(paid.status).toBe('PAID');
      expect(
        await t.prisma.ticket.count({ where: { orderId: order.id } }),
      ).toBe(2);
    });

    it('reabrir una venta finalizada vuelve a vender hasta el fin del evento', async () => {
      const created = await eventInProgress({ closeAt: fromNow(-MINUTE_MS) });

      await actOn(created, 'REOPEN').expect(200);

      expect((await savedBatch(created.batch.id)).closeAt).toBeNull();
      expect(await checkoutStatus(created.ticketType.id)).toBe(201);
    });

    it('ocultar la tanda la saca de la página del evento y de la venta, y mostrarla la devuelve', async () => {
      const created = await eventInProgress();

      await actOn(created, 'HIDE').expect(200);
      expect(await publicBatchNames(created.event.id)).toEqual([]);
      expect(await checkoutStatus(created.ticketType.id)).toBe(409);

      await actOn(created, 'SHOW').expect(200);
      expect(await publicBatchNames(created.event.id)).toEqual(['Preventa']);
      expect(await checkoutStatus(created.ticketType.id)).toBe(201);
    });

    it('no cambia el precio, el stock ni las otras tandas', async () => {
      const created = await eventInProgress();
      const other = await createBatch(t.prisma, {
        eventId: created.event.id,
        name: 'General',
      });

      await actOn(created, 'END').expect(200);

      const ticketType = await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: created.ticketType.id },
      });
      expect(Number(ticketType.price)).toBe(1000);
      expect(ticketType.stock).toBe(100);
      expect((await savedBatch(other.batch.id)).closeAt).toBeNull();
      expect(await checkoutStatus(other.ticketType.id)).toBe(201);
    });
  });

  describe('antes de que empiece el evento', () => {
    it('finalizar la venta también funciona', async () => {
      const created = await createOrganizerWithEvent(t.prisma);

      await actOn(created, 'END').expect(200);

      expect(await checkoutStatus(created.ticketType.id)).toBe(409);
    });

    it('finalizar una tanda que todavía no empezó a venderse descarta su inicio, y al reabrirla se vende desde ya', async () => {
      const created = await createOrganizerWithEvent(t.prisma, {
        batch: { publishAt: fromNow(HOUR_MS) },
      });

      await actOn(created, 'END').expect(200);
      expect((await savedBatch(created.batch.id)).publishAt).toBeNull();

      await actOn(created, 'REOPEN').expect(200);
      expect(await checkoutStatus(created.ticketType.id)).toBe(201);
    });
  });

  describe('lo que no se puede', () => {
    it('finalizar una venta que ya está finalizada', async () => {
      const closeAt = fromNow(-HOUR_MS);
      const created = await eventInProgress({ closeAt });

      await actOn(created, 'END').expect(409);

      expect((await savedBatch(created.batch.id)).closeAt).toEqual(closeAt);
    });

    it('reabrir una venta que no está finalizada, y su fin programado queda como estaba', async () => {
      const closeAt = fromNow(2 * HOUR_MS);
      const created = await eventInProgress({ closeAt });

      await actOn(created, 'REOPEN').expect(409);

      expect((await savedBatch(created.batch.id)).closeAt).toEqual(closeAt);
    });

    it('actuar sobre un evento cuyo fin ya pasó', async () => {
      const created = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: created.event.id },
        data: {
          startDate: fromNow(-5 * HOUR_MS),
          endDate: fromNow(-MINUTE_MS),
        },
      });

      await actOn(created, 'HIDE').expect(409);

      expect((await savedBatch(created.batch.id)).isVisible).toBe(true);
    });

    it('actuar sobre un evento cancelado', async () => {
      const created = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: created.event.id },
        data: { status: 'CANCELLED' },
      });

      await actOn(created, 'END').expect(409);
    });

    it('una acción que no existe', async () => {
      const created = await eventInProgress();

      await actOn(created, 'DELETE').expect(400);
      await act(
        created.organizer,
        created.event.id,
        created.batch.id,
        undefined,
      ).expect(400);
    });
  });

  describe('permisos', () => {
    it('otro organizador no puede actuar sobre la tanda', async () => {
      const created = await eventInProgress();
      const other = await createOrganizerWithEvent(t.prisma);

      await act(
        other.organizer,
        created.event.id,
        created.batch.id,
        'END',
      ).expect(403);

      expect((await savedBatch(created.batch.id)).closeAt).toBeNull();
    });

    it('un organizador no puede tocar la tanda de otro pasando su propio evento', async () => {
      const created = await eventInProgress();
      const other = await createOrganizerWithEvent(t.prisma);

      await act(
        other.organizer,
        other.event.id,
        created.batch.id,
        'END',
      ).expect(404);

      expect((await savedBatch(created.batch.id)).closeAt).toBeNull();
    });

    it('un comprador no puede actuar', async () => {
      const created = await eventInProgress();
      const buyer = await createUser(t.prisma);

      await act(buyer, created.event.id, created.batch.id, 'END').expect(403);
    });

    it('sin sesión no se puede actuar', async () => {
      const created = await eventInProgress();

      await request(t.app.getHttpServer())
        .put(`/events/${created.event.id}/batches/${created.batch.id}/sale`)
        .send({ action: 'END' })
        .expect(401);
    });

    it('una tanda que no existe responde que no la encontró', async () => {
      const created = await eventInProgress();

      await act(
        created.organizer,
        created.event.id,
        'no-es-un-id',
        'END',
      ).expect(404);
      await act(
        created.organizer,
        created.event.id,
        '3f0e5c1e-8f0a-4a52-9c59-2f6d5b1f0a11',
        'END',
      ).expect(404);
    });
  });
});
