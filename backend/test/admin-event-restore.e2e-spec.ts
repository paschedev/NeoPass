import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];

const HOUR_MS = 60 * 60 * 1000;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Panel ADMIN: restaurar un evento eliminado', () => {
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

  const http = () => request(t.app.getHttpServer());
  const createAdmin = () =>
    createUser(t.prisma, { role: 'ADMIN', name: 'Cuenta ADMIN' });

  function restore(user: User | null, eventId: string) {
    const req = http().patch(`/admin/events/${eventId}/restore`);
    return user ? req.set('Authorization', authHeader(t.app, user)) : req;
  }

  // Evento con una entrada válida y una devuelta, eliminado por su organizador.
  async function deletedEventWithTickets(
    dates: { startDate: Date; endDate: Date } | null = null,
  ) {
    const created = await createOrganizerWithEvent(t.prisma);
    if (dates) {
      await t.prisma.event.update({
        where: { id: created.event.id },
        data: dates,
      });
    }
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType: created.ticketType,
      status: 'PAID',
    });
    const ticket = await createTicket(t.prisma, {
      order,
      ticketType: created.ticketType,
    });
    const refundedBuyer = await createUser(t.prisma);
    const refundedOrder = await createOrder(t.prisma, {
      user: refundedBuyer,
      ticketType: created.ticketType,
      status: 'CANCELLED',
    });
    const refundedTicket = await createTicket(t.prisma, {
      order: refundedOrder,
      ticketType: created.ticketType,
    });
    const refunded = await t.prisma.ticket.update({
      where: { id: refundedTicket.id },
      data: { status: 'REFUNDED' },
    });
    await http()
      .delete(`/events/${created.event.id}`)
      .set('Authorization', authHeader(t.app, created.organizer))
      .send({})
      .expect(200);
    return { ...created, buyer, ticket, refundedBuyer, refunded };
  }

  function noticesOf(userId: string, title: string) {
    return t.prisma.notification.findMany({ where: { userId, title } });
  }

  function checkIn(user: User, qrCode: string) {
    return http()
      .post('/tickets/check-in')
      .set('Authorization', authHeader(t.app, user))
      .send({ qrCode })
      .expect(201);
  }

  describe('acceso', () => {
    it('sin sesión, un comprador o el mismo organizador no lo pueden restaurar', async () => {
      const { organizer, event } = await deletedEventWithTickets();

      await restore(null, event.id).expect(401);
      for (const user of [organizer, await createUser(t.prisma)]) {
        await restore(user, event.id).expect(403);
      }
      await http().get(`/events/${event.id}`).expect(404);
    });
  });

  describe('restaurar', () => {
    it('un evento que no terminó vuelve a la página pública y se puede comprar', async () => {
      const { event, ticketType } = await deletedEventWithTickets();

      const res = await restore(await createAdmin(), event.id).expect(200);

      expect(res.body).toEqual({ id: event.id, deletedAt: null });
      await http().get(`/events/${event.id}`).expect(200);
      await http()
        .post('/orders/checkout')
        .set('Authorization', authHeader(t.app, await createUser(t.prisma)))
        .send({
          captchaToken: 'captcha-de-prueba',
          items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
        })
        .expect(201);
    });

    it('en la puerta la entrada válida vuelve a pasar y la devuelta sigue sin pasar', async () => {
      const now = Date.now();
      const { organizer, event, ticket, refunded } =
        await deletedEventWithTickets({
          startDate: new Date(now - HOUR_MS),
          endDate: new Date(now + 5 * HOUR_MS),
        });

      await restore(await createAdmin(), event.id).expect(200);

      const valid = await checkIn(organizer, ticket.qrCode);
      expect((valid.body as { status: string }).status).toBe('VALID');
      const rejected = await checkIn(organizer, refunded.qrCode);
      expect((rejected.body as { status: string }).status).toBe('INVALID');
    });

    it('avisa a quienes tienen entradas válidas y al organizador, no a quienes tienen una devuelta', async () => {
      const { organizer, event, buyer, refundedBuyer } =
        await deletedEventWithTickets();

      await restore(await createAdmin(), event.id).expect(200);

      const [holderNotice] = await noticesOf(
        buyer.id,
        'Volvió Evento de prueba',
      );
      expect(holderNotice).toMatchObject({
        type: 'EVENT_UPDATE',
        message:
          'Tu entrada vuelve a servir para entrar. La tenés en Mis entradas.',
        eventId: event.id,
      });
      const [organizerNotice] = await noticesOf(
        organizer.id,
        'NeoPass restauró Evento de prueba',
      );
      expect(organizerNotice).toMatchObject({
        type: 'EVENT_UPDATE',
        eventId: event.id,
        actionUrl: `/panel/eventos/${event.id}`,
      });
      expect(
        await noticesOf(refundedBuyer.id, 'Volvió Evento de prueba'),
      ).toHaveLength(0);
    });

    it('un evento que ya terminó vuelve a su historial y solo se avisa al organizador', async () => {
      const now = Date.now();
      const { organizer, event, buyer } = await deletedEventWithTickets({
        startDate: new Date(now - 30 * HOUR_MS),
        endDate: new Date(now - 24 * HOUR_MS),
      });

      await restore(await createAdmin(), event.id).expect(200);

      const restored = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(restored.deletedAt).toBeNull();
      expect(await noticesOf(buyer.id, 'Volvió Evento de prueba')).toHaveLength(
        0,
      );
      expect(
        await noticesOf(organizer.id, 'NeoPass restauró Evento de prueba'),
      ).toHaveLength(1);
    });

    it('un evento que no está eliminado responde 409 y uno que no existe 404', async () => {
      const admin = await createAdmin();
      const { event } = await createOrganizerWithEvent(t.prisma);

      await restore(admin, event.id).expect(409);
      await restore(admin, MISSING_ID).expect(404);
      await restore(admin, 'no-es-un-id').expect(404);
    });

    it('dos restauraciones a la vez: una sola restaura y cada aviso sale una vez', async () => {
      const { organizer, event, buyer } = await deletedEventWithTickets();
      const admin = await createAdmin();

      const results = await Promise.all([
        restore(admin, event.id),
        restore(admin, event.id),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      expect(await noticesOf(buyer.id, 'Volvió Evento de prueba')).toHaveLength(
        1,
      );
      expect(
        await noticesOf(organizer.id, 'NeoPass restauró Evento de prueba'),
      ).toHaveLength(1);
    });
  });
});
