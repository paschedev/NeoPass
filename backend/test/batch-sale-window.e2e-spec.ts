import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const fromNow = (ms: number) => new Date(Date.now() + ms);

describe('Tandas con estado de venta calculado', () => {
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

  async function checkoutStatus(ticketTypeIds: string[]) {
    const buyer = await createUser(t.prisma);
    const res = await request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: ticketTypeIds.map((ticketTypeId) => ({
          ticketTypeId,
          quantity: 1,
        })),
      });
    return res.status;
  }

  type PublicBatch = { name: string; saleStatus: string };

  async function publicBatches(eventId: string) {
    const res = await request(t.app.getHttpServer())
      .get(`/events/${eventId}`)
      .expect(200);
    return (res.body as { ticketBatches: PublicBatch[] }).ticketBatches;
  }

  describe('la compra', () => {
    it('no vende entradas de una tanda oculta', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma, {
        batch: { isVisible: false },
      });

      expect(await checkoutStatus([ticketType.id])).toBe(409);
    });

    it('no vende entradas de una tanda que todavía no empezó a venderse', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma, {
        batch: { publishAt: fromNow(HOUR_MS) },
      });

      expect(await checkoutStatus([ticketType.id])).toBe(409);
    });

    it('no vende entradas de una tanda cuya venta terminó', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma, {
        batch: { closeAt: fromNow(-MINUTE_MS) },
      });

      expect(await checkoutStatus([ticketType.id])).toBe(409);
    });

    it('vende una tanda en cuanto llega su inicio de venta, sin esperar a ningún proceso', async () => {
      const { ticketType } = await createOrganizerWithEvent(t.prisma, {
        batch: { publishAt: fromNow(-MINUTE_MS) },
      });

      expect(await checkoutStatus([ticketType.id])).toBe(201);
    });

    it('vende entradas de dos tandas que están a la venta al mismo tiempo', async () => {
      const first = await createOrganizerWithEvent(t.prisma);
      const second = await createBatch(t.prisma, {
        eventId: first.event.id,
        name: 'Tanda 2',
      });

      expect(
        await checkoutStatus([first.ticketType.id, second.ticketType.id]),
      ).toBe(201);
    });
  });

  describe('el detalle público', () => {
    it('muestra el estado de cada tanda y no muestra las ocultas ni las finalizadas', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const eventId = event.id;
      await createBatch(t.prisma, {
        eventId,
        name: 'Próxima',
        publishAt: fromNow(DAY_MS),
      });
      await createBatch(t.prisma, {
        eventId,
        name: 'Agotada',
        stock: 5,
        sold: 5,
      });
      await createBatch(t.prisma, {
        eventId,
        name: 'Oculta',
        isVisible: false,
      });
      await createBatch(t.prisma, {
        eventId,
        name: 'Finalizada',
        closeAt: fromNow(-MINUTE_MS),
      });

      const batches = await publicBatches(eventId);

      expect(
        batches
          .map(({ name, saleStatus }) => ({ name, saleStatus }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ).toEqual([
        { name: 'Agotada', saleStatus: 'SOLD_OUT' },
        { name: 'Preventa', saleStatus: 'ON_SALE' },
        { name: 'Próxima', saleStatus: 'UPCOMING' },
      ]);
    });
  });

  describe('las fechas de las tandas al editar', () => {
    function putEvent(
      organizer: Parameters<typeof authHeader>[1],
      eventId: string,
      body: Record<string, unknown>,
    ) {
      return request(t.app.getHttpServer())
        .put(`/events/${eventId}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send(body);
    }

    async function editBatch(window: Record<string, unknown>, stored = {}) {
      const created = await createOrganizerWithEvent(t.prisma, {
        batch: stored,
      });
      const res = await putEvent(created.organizer, created.event.id, {
        batches: [
          {
            id: created.batch.id,
            name: 'Preventa',
            isVisible: true,
            ...window,
            ticketTypes: [
              {
                id: created.ticketType.id,
                name: 'General',
                price: 1000,
                stock: 100,
              },
            ],
          },
        ],
      });
      return { ...created, res };
    }

    it('guarda si la tanda es visible y su ventana de venta', async () => {
      const publishAt = fromNow(DAY_MS);
      const closeAt = fromNow(2 * DAY_MS);
      const { batch, res } = await editBatch({
        isVisible: false,
        publishAt: publishAt.toISOString(),
        closeAt: closeAt.toISOString(),
      });

      expect(res.status).toBe(200);
      const saved = await t.prisma.ticketBatch.findUniqueOrThrow({
        where: { id: batch.id },
      });
      expect(saved.isVisible).toBe(false);
      expect(saved.publishAt).toEqual(publishAt);
      expect(saved.closeAt).toEqual(closeAt);
    });

    it('rechaza una tanda que empieza a venderse después de terminar su venta', async () => {
      const { res } = await editBatch({
        publishAt: fromNow(2 * DAY_MS).toISOString(),
        closeAt: fromNow(DAY_MS).toISOString(),
      });

      expect(res.status).toBe(400);
    });

    it('rechaza una tanda que sigue vendiendo después de que termina el evento', async () => {
      const { res } = await editBatch({
        closeAt: fromNow(30 * DAY_MS).toISOString(),
      });

      expect(res.status).toBe(400);
    });

    it('rechaza una tanda que empieza a venderse después de que termina el evento', async () => {
      const { res } = await editBatch({
        publishAt: fromNow(30 * DAY_MS).toISOString(),
      });

      expect(res.status).toBe(400);
    });

    it('rechaza un inicio de venta nuevo que ya pasó', async () => {
      const { res } = await editBatch({
        publishAt: fromNow(-HOUR_MS).toISOString(),
      });

      expect(res.status).toBe(400);
    });

    it('conserva el inicio de venta pasado de una tanda que ya está vendiendo', async () => {
      const publishAt = fromNow(-DAY_MS);
      const { res } = await editBatch(
        { publishAt: publishAt.toISOString() },
        { publishAt },
      );

      expect(res.status).toBe(200);
    });

    it('finalizar la venta ya saca la tanda de la venta', async () => {
      const { event, ticketType, res } = await editBatch({
        closeAt: new Date().toISOString(),
      });

      expect(res.status).toBe(200);
      expect(await publicBatches(event.id)).toEqual([]);
      expect(await checkoutStatus([ticketType.id])).toBe(409);
    });

    it('no deja mover el fin del evento antes del fin de venta de una tanda', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.ticketBatch.updateMany({
        where: { eventId: event.id },
        data: { closeAt: new Date(event.endDate.getTime() - HOUR_MS) },
      });

      const res = await putEvent(organizer, event.id, {
        endDate: new Date(event.endDate.getTime() - 2 * HOUR_MS).toISOString(),
      });

      expect(res.status).toBe(400);
    });
  });

  describe('las fechas de las tandas al crear', () => {
    it('rechaza un evento con una tanda que sigue vendiendo después del evento', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);
      const startDate = fromNow(30 * DAY_MS);
      const endDate = new Date(startDate.getTime() + 6 * HOUR_MS);

      await request(t.app.getHttpServer())
        .post('/events')
        .set('Authorization', authHeader(t.app, organizer))
        .send({
          title: 'Evento nuevo',
          description: 'Descripción',
          imageUrl:
            'https://res.cloudinary.com/test-cloud/image/upload/flyer.jpg',
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          venueName: 'Club',
          venueAddress: 'Calle 123',
          status: 'PUBLISHED',
          batches: [
            {
              name: 'Preventa',
              isVisible: true,
              closeAt: new Date(endDate.getTime() + HOUR_MS).toISOString(),
              ticketTypes: [{ name: 'General', price: 1000, stock: 100 }],
            },
          ],
        })
        .expect(400);
    });
  });
});
