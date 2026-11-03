import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MyTicketBody = {
  id: string;
  status: string;
  qrCode: string;
  freeTicket: { validUntil: string | null } | null;
  ticketType: { name: string; event: Record<string, unknown> };
};

const HOUR_MS = 60 * 60 * 1000;

describe('Mis entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function myTickets(user: Parameters<typeof authHeader>[1]) {
    const res = await request(t.app.getHttpServer())
      .get('/tickets/my-tickets')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    return res.body as MyTicketBody[];
  }

  it('cada entrada trae cuándo empieza y termina el evento y su estado, sin datos internos del evento', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    const owner = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: owner,
      ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order, ticketType });

    const [ticket] = await myTickets(owner);

    expect(ticket.ticketType.event).toEqual({
      title: event.title,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: 'PUBLISHED',
      venueName: null,
      deletion: null,
    });
  });

  it('solo trae las entradas propias', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const owner = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: owner,
      ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order, ticketType });

    expect(await myTickets(await createUser(t.prisma))).toEqual([]);
  });

  describe('QR free', () => {
    const confirmed = { emailVerifiedAt: new Date() };

    async function sendFreeTickets(
      email: string,
      {
        quantity = 2,
        validUntil,
      }: { quantity?: number; validUntil?: Date } = {},
    ) {
      const setup = await createOrganizerWithEvent(t.prisma);
      const res = await request(t.app.getHttpServer())
        .post(`/events/organizer/${setup.event.id}/free-tickets`)
        .set('Authorization', authHeader(t.app, setup.organizer))
        .send({
          ticketTypeId: setup.ticketType.id,
          quantity,
          email,
          validUntil: validUntil?.toISOString(),
        })
        .expect(201);
      return { ...setup, grantId: (res.body as { id: string }).id };
    }

    async function lockedCount(user: Parameters<typeof authHeader>[1]) {
      const res = await request(t.app.getHttpServer())
        .get('/tickets/my-tickets/locked')
        .set('Authorization', authHeader(t.app, user))
        .expect(200);
      return res.body as { count: number };
    }

    it('con el correo confirmado se ven los QR free mandados a ese correo, junto a las compradas', async () => {
      const ana = await createUser(t.prisma, {
        email: 'ana@neopass.test',
        ...confirmed,
      });
      const bought = await createOrganizerWithEvent(t.prisma);
      const order = await createOrder(t.prisma, {
        user: ana,
        ticketType: bought.ticketType,
        status: 'PAID',
      });
      await createTicket(t.prisma, { order, ticketType: bought.ticketType });
      await sendFreeTickets('ana@neopass.test');

      const tickets = await myTickets(ana);

      expect(tickets).toHaveLength(3);
      expect(tickets.filter((ticket) => ticket.freeTicket)).toEqual([
        expect.objectContaining({
          status: 'VALID',
          freeTicket: { validUntil: null },
        }),
        expect.objectContaining({
          status: 'VALID',
          freeTicket: { validUntil: null },
        }),
      ]);
      expect(tickets.filter((ticket) => !ticket.freeTicket)).toHaveLength(1);
      expect(await lockedCount(ana)).toEqual({ count: 0 });
    });

    it('se ven aunque el organizador escriba el correo distinto: mayúsculas, puntos de Gmail o "+algo"', async () => {
      const ana = await createUser(t.prisma, {
        email: 'anaperez@gmail.com',
        ...confirmed,
      });
      await sendFreeTickets(' Ana.Perez+fiesta@Gmail.com ', { quantity: 1 });

      expect(await myTickets(ana)).toHaveLength(1);
    });

    it('con hora límite, la entrada dice hasta cuándo deja entrar', async () => {
      const ana = await createUser(t.prisma, {
        email: 'ana@neopass.test',
        ...confirmed,
      });
      const { event } = await createOrganizerWithEvent(t.prisma);
      const validUntil = new Date(event.startDate.getTime() + 2 * HOUR_MS);
      await sendFreeTickets('ana@neopass.test', { quantity: 1, validUntil });

      const [ticket] = await myTickets(ana);

      expect(ticket.freeTicket).toEqual({
        validUntil: validUntil.toISOString(),
      });
    });

    it('sin confirmar el correo no se ven: solo cuántas hay bloqueadas, sin datos; al confirmarlo aparecen las que ya le habían mandado', async () => {
      const ana = await createUser(t.prisma, { email: 'ana@neopass.test' });
      await sendFreeTickets('ana@neopass.test', { quantity: 3 });

      expect(await myTickets(ana)).toEqual([]);
      expect(await lockedCount(ana)).toEqual({ count: 3 });

      await t.prisma.user.update({ where: { id: ana.id }, data: confirmed });

      const tickets = await myTickets(ana);
      expect(tickets).toHaveLength(3);
      expect(tickets[0].qrCode).toEqual(expect.any(String));
      expect(await lockedCount(ana)).toEqual({ count: 0 });
    });

    it('mandados antes de que la persona tuviera cuenta, aparecen cuando la crea y confirma el correo', async () => {
      await sendFreeTickets('nueva@neopass.test');
      const nueva = await createUser(t.prisma, {
        email: 'nueva@neopass.test',
        ...confirmed,
      });

      expect(await myTickets(nueva)).toHaveLength(2);
    });

    it('otra cuenta, con otro correo, no los ve ni los cuenta', async () => {
      await sendFreeTickets('ana@neopass.test');
      const other = await createUser(t.prisma, confirmed);
      const unconfirmed = await createUser(t.prisma);

      expect(await myTickets(other)).toEqual([]);
      expect(await lockedCount(unconfirmed)).toEqual({ count: 0 });
    });

    it('bloqueadas cuentan solo las que todavía dejan entrar: no las anuladas, usadas ni de eventos terminados', async () => {
      const ana = await createUser(t.prisma, { email: 'ana@neopass.test' });
      await sendFreeTickets('ana@neopass.test', { quantity: 1 });
      const used = await sendFreeTickets('ana@neopass.test');
      await t.prisma.ticket.updateMany({
        where: { freeTicketGrantId: used.grantId },
        data: { status: 'USED' },
      });
      const cancelled = await sendFreeTickets('ana@neopass.test');
      await request(t.app.getHttpServer())
        .post(
          `/events/organizer/${cancelled.event.id}/free-tickets/${cancelled.grantId}/cancel`,
        )
        .set('Authorization', authHeader(t.app, cancelled.organizer))
        .expect(201);
      const finished = await sendFreeTickets('ana@neopass.test');
      await t.prisma.event.update({
        where: { id: finished.event.id },
        data: { status: 'FINISHED' },
      });

      expect(await lockedCount(ana)).toEqual({ count: 1 });
    });

    it('las anuladas por el organizador se ven anuladas', async () => {
      const ana = await createUser(t.prisma, {
        email: 'ana@neopass.test',
        ...confirmed,
      });
      const { event, organizer, grantId } =
        await sendFreeTickets('ana@neopass.test');
      await request(t.app.getHttpServer())
        .post(`/events/organizer/${event.id}/free-tickets/${grantId}/cancel`)
        .set('Authorization', authHeader(t.app, organizer))
        .expect(201);

      const tickets = await myTickets(ana);

      expect(tickets.map((ticket) => ticket.status)).toEqual([
        'CANCELLED',
        'CANCELLED',
      ]);
    });

    it('no se pueden transferir: el QR sigue siendo el del mail', async () => {
      const ana = await createUser(t.prisma, {
        email: 'ana@neopass.test',
        ...confirmed,
      });
      const friend = await createUser(t.prisma);
      await sendFreeTickets('ana@neopass.test', { quantity: 1 });
      const [ticket] = await myTickets(ana);

      await request(t.app.getHttpServer())
        .post(`/tickets/${ticket.id}/transfer`)
        .set('Authorization', authHeader(t.app, ana))
        .send({ targetUserId: friend.id })
        .expect(404);

      expect(
        await t.prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
      ).toMatchObject({ userId: null, qrCode: ticket.qrCode });
    });

    it('al cambiar de correo dejan de verse las del correo viejo y aparecen las del nuevo', async () => {
      const ana = await createUser(t.prisma, {
        email: 'ana@neopass.test',
        ...confirmed,
      });
      await sendFreeTickets('ana@neopass.test', { quantity: 1 });
      await sendFreeTickets('ana.nueva@neopass.test', { quantity: 2 });

      expect(await myTickets(ana)).toHaveLength(1);
      await t.prisma.user.update({
        where: { id: ana.id },
        data: { email: 'ana.nueva@neopass.test' },
      });

      expect(await myTickets(ana)).toHaveLength(2);
    });

    it('sin sesión las bloqueadas responden 401', async () => {
      await request(t.app.getHttpServer())
        .get('/tickets/my-tickets/locked')
        .expect(401);
    });
  });
});
