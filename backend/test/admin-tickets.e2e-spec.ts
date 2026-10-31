import { TicketStatus } from '@prisma/client';
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

type User = Parameters<typeof authHeader>[1];

const HOUR_MS = 60 * 60 * 1000;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const RESENDS_PER_HOUR = 10;

type AdminTicket = {
  id: string;
  code: string;
  status: TicketStatus;
  usedAt: string | null;
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    deletedAt: string | null;
  };
  ticketType: { name: string; batchName: string | null };
  owner: { name: string | null; email: string } | null;
  buyer: { name: string; email: string } | null;
  origin:
    | {
        type: 'PURCHASE';
        purchasedAt: string;
        total: number;
        promoterName: string | null;
      }
    | { type: 'FREE'; sentBy: string; validUntil: string | null };
};

type TicketsPage = {
  items: AdminTicket[];
  total: number;
  page: number;
  limit: number;
};

type MailCall = [
  string,
  {
    to: string;
    name: string | null;
    validUntil?: string | null;
    tickets: { id: string; qrCode: string; ticketTypeName: string }[];
  },
  { jobId?: string },
];

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * HOUR_MS);
}

describe('Panel ADMIN: tickets', () => {
  let t: TestApp;
  // Each resend comes from its own IP unless the test says otherwise: the
  // limit counts per IP across the whole file.
  let ipCount = 0;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());
  const createAdmin = () =>
    createUser(t.prisma, { role: 'ADMIN', name: 'Cuenta ADMIN' });

  function list(user: User | null, query: Record<string, string> = {}) {
    const req = http().get('/admin/tickets').query(query);
    return user ? req.set('Authorization', authHeader(t.app, user)) : req;
  }

  function resend(
    user: User | null,
    ticketId: string,
    ip = `10.1.0.${++ipCount}`,
  ) {
    const req = http()
      .post(`/admin/tickets/${ticketId}/resend`)
      .set('X-Forwarded-For', ip);
    return user ? req.set('Authorization', authHeader(t.app, user)) : req;
  }

  function mailCalls() {
    return t.queues.mail.add.mock.calls as MailCall[];
  }

  // A ticket bought by Compradora, by default still hers.
  async function purchasedTicket({
    transferred = false,
    viaPromoter = false,
  } = {}) {
    const created = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma, {
      name: 'Compradora',
      email: 'compradora@example.com',
    });
    const owner = transferred
      ? await createUser(t.prisma, {
          name: 'Nueva dueña',
          email: 'nueva-duena@example.com',
        })
      : buyer;
    const promoter = viaPromoter
      ? await t.prisma.eventStaff.create({
          data: {
            eventId: created.event.id,
            userId: (await createUser(t.prisma, { name: 'RRPP Lucía' })).id,
            role: 'PROMOTER',
            status: 'ACCEPTED',
          },
        })
      : null;
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType: created.ticketType,
      status: 'PAID',
      promoterId: promoter?.id,
    });
    const ticket = await createTicket(t.prisma, {
      order,
      ticketType: created.ticketType,
      ownerId: owner.id,
    });
    return { ...created, buyer, owner, order, ticket };
  }

  // A free ticket the organizer sent to Invitada, valid until 01:00.
  async function freeTicket() {
    const created = await createOrganizerWithEvent(t.prisma);
    const validUntil = hoursFromNow(24 * 7 + 2);
    const grant = await t.prisma.freeTicketGrant.create({
      data: {
        recipientEmail: 'invitada@example.com',
        recipientName: 'Invitada',
        validUntil,
        eventId: created.event.id,
        ticketTypeId: created.ticketType.id,
        issuedById: created.organizer.id,
        tickets: {
          create: [{ ticketTypeId: created.ticketType.id, isGuestList: true }],
        },
      },
      include: { tickets: true },
    });
    return { ...created, grant, validUntil, ticket: grant.tickets[0] };
  }

  async function foundIds(admin: User, q: string) {
    const res = await list(admin, { q }).expect(200);
    return (res.body as TicketsPage).items.map((item) => item.id);
  }

  describe('buscar', () => {
    it('encuentra una entrada por el código del PDF, sin importar mayúsculas', async () => {
      const admin = await createAdmin();
      const { ticket } = await purchasedTicket();
      await freeTicket();
      const code = ticket.id.slice(0, 8);

      expect(await foundIds(admin, code.toUpperCase())).toEqual([ticket.id]);
      expect(await foundIds(admin, code.toLowerCase())).toEqual([ticket.id]);
    });

    it('encuentra una entrada por el correo de su dueño, de quien la compró o de quien recibió el QR free', async () => {
      const admin = await createAdmin();
      const purchased = await purchasedTicket({ transferred: true });
      const free = await freeTicket();

      expect(await foundIds(admin, 'NUEVA-DUENA@')).toEqual([
        purchased.ticket.id,
      ]);
      expect(await foundIds(admin, 'compradora@example')).toEqual([
        purchased.ticket.id,
      ]);
      expect(await foundIds(admin, 'invitada@')).toEqual([free.ticket.id]);
      expect(await foundIds(admin, 'nadie@example.com')).toEqual([]);
    });

    it('sin búsqueda lista las entradas de a 20, las más nuevas primero', async () => {
      const admin = await createAdmin();
      const { order, ticketType } = await purchasedTicket();
      await t.prisma.ticket.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          orderId: order.id,
          ticketTypeId: ticketType.id,
          userId: order.userId,
          createdAt: hoursFromNow(i + 1),
        })),
      });
      const newest = await t.prisma.ticket.findFirstOrThrow({
        orderBy: { createdAt: 'desc' },
      });

      const first = (await list(admin).expect(200)).body as TicketsPage;
      const second = (await list(admin, { page: '2' }).expect(200))
        .body as TicketsPage;

      expect(first).toMatchObject({ total: 21, page: 1, limit: 20 });
      expect(first.items).toHaveLength(20);
      expect(first.items[0].id).toBe(newest.id);
      expect(second.items).toHaveLength(1);
    });
  });

  describe('lo que muestra de cada entrada', () => {
    it('una entrada comprada con link de RRPP y transferida trae evento, tipo, tanda, dueño, comprador y compra', async () => {
      const admin = await createAdmin();
      const { event, ticket, order } = await purchasedTicket({
        transferred: true,
        viaPromoter: true,
      });

      const res = await list(admin).expect(200);

      expect((res.body as TicketsPage).items).toEqual([
        {
          id: ticket.id,
          code: ticket.id.slice(0, 8).toUpperCase(),
          status: 'VALID',
          usedAt: null,
          event: {
            id: event.id,
            title: 'Evento de prueba',
            status: 'PUBLISHED',
            startDate: event.startDate.toISOString(),
            endDate: event.endDate.toISOString(),
            deletedAt: null,
          },
          ticketType: { name: 'General', batchName: 'Preventa' },
          owner: { name: 'Nueva dueña', email: 'nueva-duena@example.com' },
          buyer: { name: 'Compradora', email: 'compradora@example.com' },
          origin: {
            type: 'PURCHASE',
            purchasedAt: order.createdAt.toISOString(),
            total: 1000,
            promoterName: 'RRPP Lucía',
          },
        },
      ]);
    });

    it('si la entrada sigue siendo de quien la compró no repite al comprador', async () => {
      const admin = await createAdmin();
      await purchasedTicket();

      const [item] = ((await list(admin).expect(200)).body as TicketsPage)
        .items;

      expect(item.owner).toEqual({
        name: 'Compradora',
        email: 'compradora@example.com',
      });
      expect(item.buyer).toBeNull();
      expect(item.origin).toMatchObject({ promoterName: null });
    });

    it('una entrada usada trae la hora en que ingresó', async () => {
      const admin = await createAdmin();
      const { ticket } = await purchasedTicket();
      const usedAt = new Date('2026-10-10T02:40:00.000Z');
      await t.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'USED', usedAt },
      });

      const [item] = ((await list(admin).expect(200)).body as TicketsPage)
        .items;

      expect(item).toMatchObject({
        status: 'USED',
        usedAt: usedAt.toISOString(),
      });
    });

    it('un QR free trae a quién se mandó, quién lo mandó y su horario límite', async () => {
      const admin = await createAdmin();
      const { organizer, validUntil } = await freeTicket();

      const [item] = ((await list(admin).expect(200)).body as TicketsPage)
        .items;

      expect(item.owner).toEqual({
        name: 'Invitada',
        email: 'invitada@example.com',
      });
      expect(item.buyer).toBeNull();
      expect(item.origin).toEqual({
        type: 'FREE',
        sentBy: organizer.name,
        validUntil: validUntil.toISOString(),
      });
    });

    it('nunca trae el QR, que es lo que deja entrar', async () => {
      const admin = await createAdmin();
      const purchased = await purchasedTicket();
      const free = await freeTicket();

      const res = await list(admin).expect(200);

      const body = JSON.stringify(res.body);
      expect(body).not.toContain(purchased.ticket.qrCode);
      expect(body).not.toContain(free.ticket.qrCode);
      expect(body).not.toContain('qrCode');
    });
  });

  describe('reenviar', () => {
    it('manda el PDF de una entrada comprada al correo de su dueño actual, con el QR vigente', async () => {
      const admin = await createAdmin();
      const { ticket } = await purchasedTicket({ transferred: true });

      const res = await resend(admin, ticket.id).expect(201);

      expect(res.body).toEqual({ sentTo: 'nueva-duena@example.com' });
      const [[name, job]] = mailCalls();
      expect(name).toBe('send-tickets');
      expect(job).toMatchObject({
        to: 'nueva-duena@example.com',
        name: 'Nueva dueña',
      });
      expect(job.tickets).toEqual([
        expect.objectContaining({
          id: ticket.id,
          qrCode: ticket.qrCode,
          ticketTypeName: 'General',
        }),
      ]);
      const after = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: ticket.id },
      });
      expect(after.qrCode).toBe(ticket.qrCode);
    });

    it('manda un QR free a quien lo recibió, con su horario límite', async () => {
      const admin = await createAdmin();
      const { ticket, validUntil } = await freeTicket();

      const res = await resend(admin, ticket.id).expect(201);

      expect(res.body).toEqual({ sentTo: 'invitada@example.com' });
      const [[name, job]] = mailCalls();
      expect(name).toBe('send-free-tickets');
      expect(job).toMatchObject({
        to: 'invitada@example.com',
        name: 'Invitada',
        validUntil: validUntil.toISOString(),
      });
      expect(job.tickets).toEqual([
        expect.objectContaining({ id: ticket.id, qrCode: ticket.qrCode }),
      ]);
    });

    it.each<[string, TicketStatus]>([
      ['usada', 'USED'],
      ['anulada', 'CANCELLED'],
      ['devuelta', 'REFUNDED'],
    ])('no reenvía una entrada %s', async (_, status) => {
      const admin = await createAdmin();
      const { ticket } = await purchasedTicket();
      await t.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status },
      });

      await resend(admin, ticket.id).expect(409);

      expect(t.queues.mail.add).not.toHaveBeenCalled();
    });

    it.each([
      ['eliminado', { deletedAt: new Date() }],
      ['terminado', { startDate: hoursFromNow(-8), endDate: hoursFromNow(-2) }],
      ['cancelado', { status: 'CANCELLED' as const }],
    ])('no reenvía la entrada de un evento %s', async (_, eventChange) => {
      const admin = await createAdmin();
      const { event, ticket } = await purchasedTicket();
      await t.prisma.event.update({
        where: { id: event.id },
        data: eventChange,
      });

      await resend(admin, ticket.id).expect(409);

      expect(t.queues.mail.add).not.toHaveBeenCalled();
    });

    it('responde 404 si la entrada no existe', async () => {
      const admin = await createAdmin();

      await resend(admin, MISSING_ID).expect(404);
    });

    it(`después de ${RESENDS_PER_HOUR} reenvíos en una hora responde 429`, async () => {
      const admin = await createAdmin();
      const { ticket } = await purchasedTicket();

      for (let i = 0; i < RESENDS_PER_HOUR; i++) {
        await resend(admin, ticket.id, '10.2.0.1').expect(201);
      }
      await resend(admin, ticket.id, '10.2.0.1').expect(429);

      expect(t.queues.mail.add).toHaveBeenCalledTimes(RESENDS_PER_HOUR);
    });
  });

  describe('acceso', () => {
    it.each(['CUSTOMER', 'ORGANIZER'] as const)(
      'una cuenta %s recibe 403 al buscar y al reenviar',
      async (role) => {
        const user = await createUser(t.prisma, { role });
        const { ticket } = await purchasedTicket();

        await list(user).expect(403);
        await resend(user, ticket.id).expect(403);

        expect(t.queues.mail.add).not.toHaveBeenCalled();
      },
    );

    it('sin sesión responde 401', async () => {
      const { ticket } = await purchasedTicket();

      await list(null).expect(401);
      await resend(null, ticket.id).expect(401);
    });
  });
});
