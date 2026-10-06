import { Logger } from '@nestjs/common';
import { TicketStatus, User } from '@prisma/client';
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

const DAY_MS = 24 * 60 * 60 * 1000;

describe('Avisos de cambios del evento a quien tiene entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function setup() {
    const { organizer, event, batch, ticketType } =
      await createOrganizerWithEvent(t.prisma);
    await t.prisma.event.update({
      where: { id: event.id },
      data: { venueName: 'Club Y', venueAddress: 'Av. Siempreviva 742' },
    });
    return { organizer, event, batch, ticketType };
  }

  type Setup = Awaited<ReturnType<typeof setup>>;

  // `count` entradas compradas por `buyer`; por defecto las tiene él mismo.
  async function tickets(
    s: Setup,
    buyer: User,
    count: number,
    {
      owner = buyer,
      status = 'VALID',
    }: { owner?: User; status?: TicketStatus } = {},
  ) {
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType: s.ticketType,
      quantity: count,
      status: 'PAID',
    });
    for (let i = 0; i < count; i++) {
      const ticket = await createTicket(t.prisma, {
        order,
        ticketType: s.ticketType,
        ownerId: owner.id,
      });
      await t.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status },
      });
    }
  }

  function edit(user: User, eventId: string, changes: Record<string, unknown>) {
    return request(t.app.getHttpServer())
      .put(`/events/${eventId}`)
      .set('Authorization', authHeader(t.app, user))
      .send(changes);
  }

  function notices(user: User) {
    return t.prisma.notification.findMany({
      where: { userId: user.id, type: 'EVENT_UPDATE' },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Pasa el evento al día siguiente: inicio y fin.
  const postponed = (s: Setup) => ({
    startDate: new Date(s.event.startDate.getTime() + DAY_MS).toISOString(),
    endDate: new Date(s.event.endDate.getTime() + DAY_MS).toISOString(),
  });

  it('al cambiar la fecha, quien tiene entradas recibe un solo aviso con la fecha nueva y link a Mis entradas', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 3);

    await edit(s.organizer, s.event.id, postponed(s)).expect(200);

    expect(await notices(buyer)).toEqual([
      expect.objectContaining({
        title: `Cambios en ${s.event.title}`,
        message: expect.stringMatching(
          new RegExp(`^Cambió la fecha de ${s.event.title}\\. Ahora es del `),
        ) as unknown,
        eventId: s.event.id,
        actionUrl: '/panel/tickets',
        isRead: false,
      }),
    ]);
  });

  it('al cambiar el lugar, el aviso dice dónde es ahora', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);

    await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(200);

    expect((await notices(buyer)).map((n) => n.message)).toEqual([
      `Cambió el lugar de ${s.event.title}. Ahora es en Otro club (Av. Siempreviva 742).`,
    ]);
  });

  it('editar desde el formulario, que manda también las tandas, avisa igual', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);

    await edit(s.organizer, s.event.id, {
      venueName: 'Otro club',
      batches: [
        {
          id: s.batch.id,
          name: s.batch.name,
          isVisible: true,
          ticketTypes: [
            { id: s.ticketType.id, name: 'General', price: 1000, stock: 100 },
          ],
        },
      ],
    }).expect(200);

    expect((await notices(buyer)).map((n) => n.message)).toEqual([
      `Cambió el lugar de ${s.event.title}. Ahora es en Otro club (Av. Siempreviva 742).`,
    ]);
  });

  it('cambiar el título, la descripción o el flyer no le avisa a nadie', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);

    await edit(s.organizer, s.event.id, {
      title: 'Título nuevo',
      description: 'Descripción nueva',
    }).expect(200);

    expect(await notices(buyer)).toEqual([]);
  });

  it('solo avisa a quien tiene entradas válidas: las devueltas o anuladas no', async () => {
    const s = await setup();
    const refunded = await createUser(t.prisma);
    await tickets(s, refunded, 1, { status: 'REFUNDED' });
    const cancelled = await createUser(t.prisma);
    await tickets(s, cancelled, 1, { status: 'CANCELLED' });

    await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(200);

    expect(await notices(refunded)).toEqual([]);
    expect(await notices(cancelled)).toEqual([]);
  });

  it('quien recibió una entrada transferida recibe el aviso; quien la transfirió, no', async () => {
    const s = await setup();
    const seller = await createUser(t.prisma);
    const receiver = await createUser(t.prisma);
    await tickets(s, seller, 1, { owner: receiver });

    await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(200);

    expect(await notices(receiver)).toHaveLength(1);
    expect(await notices(seller)).toEqual([]);
  });

  it('quien edita no se avisa a sí mismo aunque tenga entradas', async () => {
    const s = await setup();
    await tickets(s, s.organizer, 1);

    await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(200);

    expect(await notices(s.organizer)).toEqual([]);
  });

  it('varias ediciones seguidas dejan un solo aviso sin leer, con los datos finales y todo lo que cambió', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);

    await edit(s.organizer, s.event.id, postponed(s)).expect(200);
    await edit(s.organizer, s.event.id, { venueName: 'Club Z' }).expect(200);
    await edit(s.organizer, s.event.id, { venueName: 'Club W' }).expect(200);

    const [notice, ...rest] = await notices(buyer);
    expect(rest).toEqual([]);
    expect(notice.message).toMatch(
      new RegExp(
        `^Cambiaron la fecha y el lugar de ${s.event.title}\\. Ahora es del .+, en Club W \\(Av\\. Siempreviva 742\\)\\.$`,
      ),
    );
  });

  it('si ya leyó el aviso, el cambio siguiente le llega como uno nuevo', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);
    await edit(s.organizer, s.event.id, { venueName: 'Club Z' }).expect(200);
    await request(t.app.getHttpServer())
      .put('/notifications/read-all')
      .set('Authorization', authHeader(t.app, buyer))
      .expect(200);

    await edit(s.organizer, s.event.id, { venueName: 'Club W' }).expect(200);

    expect((await notices(buyer)).map((n) => [n.message, n.isRead])).toEqual([
      [
        `Cambió el lugar de ${s.event.title}. Ahora es en Club Z (Av. Siempreviva 742).`,
        true,
      ],
      [
        `Cambió el lugar de ${s.event.title}. Ahora es en Club W (Av. Siempreviva 742).`,
        false,
      ],
    ]);
  });

  it('un evento en borrador no avisa', async () => {
    const s = await setup();
    await t.prisma.event.update({
      where: { id: s.event.id },
      data: { status: 'DRAFT' },
    });
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);

    await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(200);

    expect(await notices(buyer)).toEqual([]);
  });

  it('si no se puede guardar el aviso, el cambio queda guardado igual y se registra el error', async () => {
    const s = await setup();
    const buyer = await createUser(t.prisma);
    await tickets(s, buyer, 1);
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    await t.prisma.$executeRawUnsafe(
      'ALTER TABLE "Notification" ADD CONSTRAINT "no_notices" CHECK (false) NOT VALID',
    );
    try {
      await edit(s.organizer, s.event.id, { venueName: 'Otro club' }).expect(
        200,
      );
      expect(logged).toHaveBeenCalledWith(
        `Could not notify the change of event ${s.event.id}`,
        expect.anything(),
      );
    } finally {
      await t.prisma.$executeRawUnsafe(
        'ALTER TABLE "Notification" DROP CONSTRAINT "no_notices"',
      );
      logged.mockRestore();
    }

    const saved = await t.prisma.event.findUniqueOrThrow({
      where: { id: s.event.id },
    });
    expect(saved.venueName).toBe('Otro club');
    expect(await notices(buyer)).toEqual([]);
  });
});
