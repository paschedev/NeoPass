import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];

type Attendee = {
  ticketId: string;
  name: string | null;
  ticketType: string;
  batch: string | null;
  status: string;
  checkedInAt: string | null;
  freeTicket: boolean;
};
type AttendeePage = {
  items: Attendee[];
  total: number;
  page: number;
  limit: number;
};
type CheckIns = {
  checkedIn: number;
  total: number;
  byTicketType: {
    name: string;
    batch: string | null;
    checkedIn: number;
    total: number;
  }[];
};

describe('Público e ingreso del evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const get = (user: User, path: string) =>
    request(t.app.getHttpServer())
      .get(path)
      .set('Authorization', authHeader(t.app, user));

  // Evento con tres compradores: Ana (2 entradas, una ya ingresó), Bruno (1
  // Campo) y Carla (1 devuelta).
  async function eventWithAttendees() {
    const created = await createOrganizerWithEvent(t.prisma);
    const campo = await createBatch(t.prisma, {
      eventId: created.event.id,
      name: 'General',
    });
    await t.prisma.ticketType.update({
      where: { id: campo.ticketType.id },
      data: { name: 'Campo' },
    });
    const ana = await createUser(t.prisma, {
      name: 'Ana Pérez',
      email: 'ana@mail.test',
    });
    const bruno = await createUser(t.prisma, {
      name: 'Bruno Díaz',
      email: 'bruno@mail.test',
    });
    const carla = await createUser(t.prisma, {
      name: 'Carla Gómez',
      email: 'carla@mail.test',
    });
    const anaOrder = await createOrder(t.prisma, {
      user: ana,
      ticketType: created.ticketType,
      quantity: 2,
      status: 'PAID',
    });
    const anaIn = await createTicket(t.prisma, {
      order: anaOrder,
      ticketType: created.ticketType,
    });
    await createTicket(t.prisma, {
      order: anaOrder,
      ticketType: created.ticketType,
    });
    const usedAt = new Date('2026-10-10T02:30:00.000Z');
    await t.prisma.ticket.update({
      where: { id: anaIn.id },
      data: { status: 'USED', usedAt },
    });
    const brunoOrder = await createOrder(t.prisma, {
      user: bruno,
      ticketType: campo.ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, {
      order: brunoOrder,
      ticketType: campo.ticketType,
    });
    const carlaOrder = await createOrder(t.prisma, {
      user: carla,
      ticketType: created.ticketType,
      status: 'CANCELLED',
    });
    const refunded = await createTicket(t.prisma, {
      order: carlaOrder,
      ticketType: created.ticketType,
    });
    await t.prisma.ticket.update({
      where: { id: refunded.id },
      data: { status: 'REFUNDED' },
    });
    return { ...created, ana, bruno, carla, usedAt };
  }

  // Un QR free de "General" mandado a Dani.
  async function freeTicketFor(eventId: string, organizerId: string) {
    const ticketType = await t.prisma.ticketType.findFirstOrThrow({
      where: { eventId, name: 'General' },
    });
    await t.prisma.freeTicketGrant.create({
      data: {
        eventId,
        ticketTypeId: ticketType.id,
        issuedById: organizerId,
        recipientEmail: 'dani@mail.test',
        recipientName: 'Dani Invitada',
        tickets: {
          create: { ticketTypeId: ticketType.id, isGuestList: true },
        },
      },
    });
  }

  describe('la lista del público', () => {
    it('muestra a cada dueño de entrada con la entrada, la tanda, el estado y el ingreso, sin su email', async () => {
      const { organizer, event, usedAt } = await eventWithAttendees();

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees`,
      ).expect(200);

      const page = res.body as AttendeePage;
      expect(page).toMatchObject({ total: 4, page: 1, limit: 50 });
      expect(
        page.items.map(({ ticketId, ...attendee }) => {
          expect(ticketId).toEqual(expect.any(String));
          return attendee;
        }),
      ).toEqual([
        {
          name: 'Ana Pérez',
          ticketType: 'General',
          batch: 'Preventa',
          status: 'USED',
          checkedInAt: usedAt.toISOString(),
          freeTicket: false,
        },
        {
          name: 'Ana Pérez',
          ticketType: 'General',
          batch: 'Preventa',
          status: 'VALID',
          checkedInAt: null,
          freeTicket: false,
        },
        {
          name: 'Bruno Díaz',
          ticketType: 'Campo',
          batch: 'General',
          status: 'VALID',
          checkedInAt: null,
          freeTicket: false,
        },
        {
          name: 'Carla Gómez',
          ticketType: 'General',
          batch: 'Preventa',
          status: 'REFUNDED',
          checkedInAt: null,
          freeTicket: false,
        },
      ]);
      expect(JSON.stringify(res.body)).not.toContain('@mail.test');
    });

    it('los QR free figuran con el nombre del envío, sin el correo, marcados como QR free', async () => {
      const { organizer, event } = await eventWithAttendees();
      await freeTicketFor(event.id, organizer.id);

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees?q=dani`,
      ).expect(200);

      const page = res.body as AttendeePage;
      expect(page.total).toBe(1);
      expect(page.items[0]).toMatchObject({
        name: 'Dani Invitada',
        ticketType: 'General',
        status: 'VALID',
        freeTicket: true,
      });
      expect(JSON.stringify(res.body)).not.toContain('dani@mail.test');
    });

    it('nunca expone el código del QR', async () => {
      const { organizer, event } = await eventWithAttendees();

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees`,
      ).expect(200);

      expect(JSON.stringify(res.body)).not.toContain('qrCode');
      const codes = await t.prisma.ticket.findMany({
        select: { qrCode: true },
      });
      for (const { qrCode } of codes) {
        expect(JSON.stringify(res.body)).not.toContain(qrCode);
      }
    });

    it('busca por nombre sin importar mayúsculas, también el del envío de un QR free', async () => {
      const { organizer, event } = await eventWithAttendees();
      await freeTicketFor(event.id, organizer.id);

      const byName = await get(
        organizer,
        `/events/organizer/${event.id}/attendees?q=BRUNO`,
      ).expect(200);
      const byRecipientName = await get(
        organizer,
        `/events/organizer/${event.id}/attendees?q=invitada`,
      ).expect(200);

      expect(
        (byName.body as AttendeePage).items.map(({ name }) => name),
      ).toEqual(['Bruno Díaz']);
      expect(
        (byRecipientName.body as AttendeePage).items.map(({ name }) => name),
      ).toEqual(['Dani Invitada']);
    });

    // Searching by email would tell whether an address has a ticket even
    // though the list never shows it.
    it.each(['ana@mail.test', 'ANA@MAIL', 'mail.test', 'dani@'])(
      'buscar por un email no encuentra a nadie: %s',
      async (q) => {
        const { organizer, event } = await eventWithAttendees();
        await freeTicketFor(event.id, organizer.id);

        const res = await get(
          organizer,
          `/events/organizer/${event.id}/attendees?q=${encodeURIComponent(q)}`,
        ).expect(200);

        expect((res.body as AttendeePage).total).toBe(0);
      },
    );

    it('pagina la lista', async () => {
      const { organizer, event } = await eventWithAttendees();

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees?page=2&limit=3`,
      ).expect(200);

      const page = res.body as AttendeePage;
      expect(page).toMatchObject({ total: 4, page: 2, limit: 3 });
      expect(page.items.map(({ name }) => name)).toEqual(['Carla Gómez']);
    });

    it('una entrada transferida figura a nombre de quien la tiene ahora', async () => {
      const { organizer, event, bruno } = await eventWithAttendees();
      const nuevo = await createUser(t.prisma, {
        name: 'Zoe Transferida',
        email: 'zoe@mail.test',
      });
      await t.prisma.ticket.updateMany({
        where: { order: { userId: bruno.id } },
        data: { userId: nuevo.id },
      });

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees?q=zoe`,
      ).expect(200);

      expect((res.body as AttendeePage).items).toEqual([
        expect.objectContaining({ name: 'Zoe Transferida' }),
      ]);
    });

    it('no mezcla el público de otros eventos', async () => {
      const mine = await createOrganizerWithEvent(t.prisma);
      await eventWithAttendees();

      const res = await get(
        mine.organizer,
        `/events/organizer/${mine.event.id}/attendees`,
      ).expect(200);

      expect((res.body as AttendeePage).total).toBe(0);
    });

    it.each([
      ['una búsqueda demasiado larga', `q=${'a'.repeat(101)}`],
      ['una página que no existe', 'page=0'],
      ['demasiadas filas por página', 'limit=101'],
    ])('rechaza %s', async (_case, query) => {
      const { organizer, event } = await eventWithAttendees();

      await get(
        organizer,
        `/events/organizer/${event.id}/attendees?${query}`,
      ).expect(400);
    });
  });

  describe('el ingreso en puerta', () => {
    it('cuenta cuántos ingresaron sobre las entradas válidas, en total y por tipo', async () => {
      const { organizer, event } = await eventWithAttendees();

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/check-ins`,
      ).expect(200);

      expect(res.body as CheckIns).toEqual({
        checkedIn: 1,
        total: 3,
        byTicketType: [
          { name: 'General', batch: 'Preventa', checkedIn: 1, total: 2 },
          { name: 'Campo', batch: 'General', checkedIn: 0, total: 1 },
        ],
      });
    });
  });

  describe('la exportación', () => {
    it('descarga un CSV con todo el público, sin emails', async () => {
      const { organizer, event } = await eventWithAttendees();

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees/export`,
      ).expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain(
        'attachment; filename="publico.csv"',
      );
      const lines = res.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n');
      expect(lines[0]).toBe(
        '"Nombre","Entrada","Tanda","Estado","Ingreso","Origen"',
      );
      expect(lines).toHaveLength(5);
      expect(lines[1]).toBe(
        '"Ana Pérez","General","Preventa","Ingresó","9/10/2026 23:30","Compra"',
      );
      expect(lines[4]).toContain('"Devuelta"');
      expect(res.text).not.toContain('@mail.test');
    });

    it('incluye los QR free con el nombre del envío, sin el correo', async () => {
      const { organizer, event } = await eventWithAttendees();
      await freeTicketFor(event.id, organizer.id);

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees/export`,
      ).expect(200);

      expect(res.text).toContain(
        '"Dani Invitada","General","Preventa","Válida","","QR free"',
      );
      expect(res.text).not.toContain('dani@mail.test');
    });

    it('neutraliza las fórmulas que alguien haya puesto como nombre', async () => {
      const { organizer, event, bruno } = await eventWithAttendees();
      await t.prisma.user.update({
        where: { id: bruno.id },
        data: { name: '=HYPERLINK("http://malo")' },
      });

      const res = await get(
        organizer,
        `/events/organizer/${event.id}/attendees/export`,
      ).expect(200);

      expect(res.text).toContain(`"'=HYPERLINK(""http://malo"")"`);
    });
  });

  describe('permisos', () => {
    it.each(['attendees', 'attendees/export', 'check-ins'])(
      'para otro organizador no existe %s del evento',
      async (path) => {
        const { event } = await eventWithAttendees();
        const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

        await get(intruder, `/events/organizer/${event.id}/${path}`).expect(
          404,
        );
      },
    );

    it('para un comprador el público del evento no existe', async () => {
      const { event, ana } = await eventWithAttendees();

      await get(ana, `/events/organizer/${event.id}/attendees`).expect(404);
    });
  });
});
