import request from 'supertest';
import { EventPermission, StaffStatus, User } from '@prisma/client';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;

const ALL_PERMISSIONS: EventPermission[] = [
  'EDIT_EVENT',
  'MANAGE_BATCHES',
  'VIEW_SALES',
  'SEND_FREE_TICKETS',
  'VIEW_ATTENDEES',
  'MANAGE_STAFF',
];

const DENIED_MESSAGE: Record<EventPermission, string> = {
  EDIT_EVENT: 'No tenés permiso para editar la info del evento',
  MANAGE_BATCHES: 'No tenés permiso para manejar tandas y precios',
  VIEW_SALES: 'No tenés permiso para ver ventas y recaudación',
  SEND_FREE_TICKETS: 'No tenés permiso para mandar QR free',
  VIEW_ATTENDEES: 'No tenés permiso para ver y exportar asistentes',
  MANAGE_STAFF: 'No tenés permiso para manejar el staff y los pagos a RPPs',
};

type TicketTypeView = { id: string; sold?: number; reserved?: number };

type OrganizerEventView = {
  id: string;
  access: {
    role: string;
    permissions: EventPermission[];
    freeTicketLimit: number | null;
  };
  ticketTypes: TicketTypeView[];
  ticketBatches: { ticketTypes: TicketTypeView[] }[];
};

type Grant = {
  id: string;
  recipientEmail: string;
  issuedBy: { name: string };
};

describe('Co-organizadores: permisos sobre el evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  // Event of an owner with a co-organizer (a buyer account), a promoter with
  // something to pay, someone to invite and a free ticket grant the
  // co-organizer sent an hour ago.
  async function scenario(
    permissions: EventPermission[],
    {
      status = 'ACCEPTED',
      freeTicketLimit = null,
    }: { status?: StaffStatus; freeTicketLimit?: number | null } = {},
  ) {
    const created = await createOrganizerWithEvent(t.prisma);
    const { event, ticketType } = created;
    const member = await createUser(t.prisma, { name: 'Ana Pérez' });
    const staff = await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: member.id,
        role: 'MANAGER',
        status,
        permissions,
        freeTicketLimit,
      },
    });
    const promoter = await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: (await createUser(t.prisma, { name: 'Carla Gómez' })).id,
        role: 'PROMOTER',
        status: 'ACCEPTED',
        commissionType: 'FIXED',
        commissionValue: 100,
        totalEarned: 500,
      },
    });
    const invitee = await createUser(t.prisma);
    const grant = await t.prisma.freeTicketGrant.create({
      data: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        issuedById: member.id,
        recipientEmail: 'invitada@example.com',
        lastSentAt: new Date(Date.now() - HOUR_MS),
        tickets: {
          create: [{ ticketTypeId: ticketType.id, isGuestList: true }],
        },
      },
    });
    return { ...created, member, staff, promoter, invitee, grant };
  }

  type Scenario = Awaited<ReturnType<typeof scenario>>;

  const as = (user: User) => authHeader(t.app, user);

  function get(user: User, path: string) {
    return request(server()).get(path).set('Authorization', as(user));
  }

  function put(user: User, path: string, body: object) {
    return request(server())
      .put(path)
      .set('Authorization', as(user))
      .send(body);
  }

  function post(user: User, path: string, body: object = {}) {
    return request(server())
      .post(path)
      .set('Authorization', as(user))
      .send(body);
  }

  // The batch as stored, with one change for the price.
  function batchesWithPrice(s: Scenario, price: number | string) {
    return [
      {
        id: s.batch.id,
        name: 'Preventa',
        isVisible: true,
        ticketTypes: [
          { id: s.ticketType.id, name: 'General', price, stock: 100 },
        ],
      },
    ];
  }

  type Route = [
    string,
    EventPermission | null,
    (s: Scenario, user: User) => request.Test,
    number,
  ];

  const ROUTES: Route[] = [
    [
      'ver el evento',
      null,
      (s, u) => get(u, `/events/organizer/${s.event.id}`),
      200,
    ],
    [
      'ver el ingreso en puerta',
      null,
      (s, u) => get(u, `/events/organizer/${s.event.id}/check-ins`),
      200,
    ],
    [
      'editar la info',
      'EDIT_EVENT',
      (s, u) => put(u, `/events/${s.event.id}`, { title: 'Otro título' }),
      200,
    ],
    [
      'pedir la firma para subir el flyer',
      'EDIT_EVENT',
      (s, u) => get(u, `/media/presign?eventId=${s.event.id}`),
      200,
    ],
    [
      'cambiar las tandas desde el formulario',
      'MANAGE_BATCHES',
      (s, u) =>
        put(u, `/events/${s.event.id}`, {
          batches: batchesWithPrice(s, 1500),
        }),
      200,
    ],
    [
      'cambiar las tandas',
      'MANAGE_BATCHES',
      (s, u) =>
        put(u, `/events/${s.event.id}/batches`, {
          batches: batchesWithPrice(s, 1500),
        }),
      200,
    ],
    [
      'finalizar la venta de una tanda',
      'MANAGE_BATCHES',
      (s, u) =>
        put(u, `/events/${s.event.id}/batches/${s.batch.id}/sale`, {
          action: 'END',
        }),
      200,
    ],
    [
      'ver las ventas',
      'VIEW_SALES',
      (s, u) => get(u, `/events/organizer/${s.event.id}/sales`),
      200,
    ],
    [
      'ver los asistentes',
      'VIEW_ATTENDEES',
      (s, u) => get(u, `/events/organizer/${s.event.id}/attendees`),
      200,
    ],
    [
      'exportar los asistentes',
      'VIEW_ATTENDEES',
      (s, u) => get(u, `/events/organizer/${s.event.id}/attendees/export`),
      200,
    ],
    [
      'invitar a un scanner',
      'MANAGE_STAFF',
      (s, u) =>
        post(u, `/events/${s.event.id}/staff`, {
          userId: s.invitee.id,
          role: 'SCANNER',
        }),
      201,
    ],
    [
      'ver el staff',
      'MANAGE_STAFF',
      (s, u) => get(u, `/events/${s.event.id}/staff`),
      200,
    ],
    [
      'ver los RPPs',
      'MANAGE_STAFF',
      (s, u) => get(u, `/events/organizer/${s.event.id}/promoters`),
      200,
    ],
    [
      'registrar un pago a un RPP',
      'MANAGE_STAFF',
      (s, u) =>
        post(
          u,
          `/events/organizer/${s.event.id}/promoters/${s.promoter.id}/payments`,
          { amount: 100 },
        ),
      201,
    ],
    [
      'mandar QR free',
      'SEND_FREE_TICKETS',
      (s, u) =>
        post(u, `/events/organizer/${s.event.id}/free-tickets`, {
          ticketTypeId: s.ticketType.id,
          quantity: 1,
          email: 'otra@example.com',
        }),
      201,
    ],
    [
      'ver los QR free',
      'SEND_FREE_TICKETS',
      (s, u) => get(u, `/events/organizer/${s.event.id}/free-tickets`),
      200,
    ],
    [
      'anular un envío de QR free',
      'SEND_FREE_TICKETS',
      (s, u) =>
        post(
          u,
          `/events/organizer/${s.event.id}/free-tickets/${s.grant.id}/cancel`,
        ),
      201,
    ],
    [
      'reenviar un envío de QR free',
      'SEND_FREE_TICKETS',
      (s, u) =>
        post(
          u,
          `/events/organizer/${s.event.id}/free-tickets/${s.grant.id}/resend`,
        ),
      201,
    ],
  ];

  describe('cada ruta pide su permiso', () => {
    it.each(ROUTES)(
      'un co-organizador con cuenta de comprador y solo ese permiso puede %s',
      async (_case, permission, call, ok) => {
        const s = await scenario(permission ? [permission] : []);

        await call(s, s.member).expect(ok);
      },
    );

    it.each(ROUTES.filter(([, permission]) => permission !== null))(
      'sin el permiso, un co-organizador con todos los demás no puede %s',
      async (_case, permission, call) => {
        const s = await scenario(
          ALL_PERMISSIONS.filter((other) => other !== permission),
        );

        const res = await call(s, s.member).expect(403);

        expect((res.body as { message: string }).message).toBe(
          DENIED_MESSAGE[permission as EventPermission],
        );
      },
    );

    it.each(ROUTES)(
      'para %s, el evento no existe para quien no es del equipo',
      async (_case, _permission, call) => {
        const s = await scenario(ALL_PERMISSIONS, { status: 'PENDING' });
        const rejected = await createUser(t.prisma);
        await t.prisma.eventStaff.create({
          data: {
            eventId: s.event.id,
            userId: rejected.id,
            role: 'MANAGER',
            status: 'REJECTED',
            permissions: ALL_PERMISSIONS,
          },
        });
        const removed = await createUser(t.prisma);
        const removedStaff = await t.prisma.eventStaff.create({
          data: {
            eventId: s.event.id,
            userId: removed.id,
            role: 'MANAGER',
            status: 'ACCEPTED',
            permissions: ALL_PERMISSIONS,
          },
        });
        await t.prisma.eventStaff.delete({ where: { id: removedStaff.id } });
        const scanner = await createUser(t.prisma);
        await t.prisma.eventStaff.create({
          data: {
            eventId: s.event.id,
            userId: scanner.id,
            role: 'SCANNER',
            status: 'ACCEPTED',
          },
        });
        const otherOrganizer = (await createOrganizerWithEvent(t.prisma))
          .organizer;
        const buyer = await createUser(t.prisma);

        for (const outsider of [
          s.member,
          rejected,
          removed,
          scanner,
          otherOrganizer,
          buyer,
        ]) {
          await call(s, outsider).expect(404);
        }
      },
    );
  });

  describe('editar el evento', () => {
    // What the edit form sends: every field, the batches included.
    function wholeForm(s: Scenario, changes: Record<string, unknown> = {}) {
      return {
        title: s.event.title,
        description: s.event.description,
        startDate: s.event.startDate.toISOString(),
        endDate: s.event.endDate.toISOString(),
        batches: batchesWithPrice(s, '1000'),
        ...changes,
      };
    }

    async function storedEvent(s: Scenario) {
      return t.prisma.event.findUniqueOrThrow({
        where: { id: s.event.id },
        include: { ticketTypes: true },
      });
    }

    it('con "Editar la info", guardar el formulario con las tandas sin cambios cambia solo la info', async () => {
      const s = await scenario(['EDIT_EVENT']);

      await put(
        s.member,
        `/events/${s.event.id}`,
        wholeForm(s, { title: 'Fiesta de fin de año' }),
      ).expect(200);

      const saved = await storedEvent(s);
      expect(saved.title).toBe('Fiesta de fin de año');
      expect(saved.ticketTypes[0].price.toNumber()).toBe(1000);
    });

    it('con "Editar la info", si además cambia un precio, da 403 y no guarda nada', async () => {
      const s = await scenario(['EDIT_EVENT']);

      const res = await put(
        s.member,
        `/events/${s.event.id}`,
        wholeForm(s, {
          title: 'Fiesta de fin de año',
          batches: batchesWithPrice(s, 1500),
        }),
      ).expect(403);

      expect((res.body as { message: string }).message).toBe(
        DENIED_MESSAGE.MANAGE_BATCHES,
      );
      const saved = await storedEvent(s);
      expect(saved.title).toBe(s.event.title);
      expect(saved.ticketTypes[0].price.toNumber()).toBe(1000);
    });

    it.each([
      [
        'agrega una tanda',
        (s: Scenario) => [
          ...batchesWithPrice(s, 1000),
          {
            name: 'VIP',
            isVisible: true,
            ticketTypes: [{ name: 'Mesa', price: 5000, stock: 10 }],
          },
        ],
      ],
      ['borra una tanda', () => []],
    ])('con "Editar la info", si %s da 403', async (_case, batches) => {
      const s = await scenario(['EDIT_EVENT']);

      const res = await put(
        s.member,
        `/events/${s.event.id}`,
        wholeForm(s, { batches: batches(s) }),
      ).expect(403);

      expect((res.body as { message: string }).message).toBe(
        DENIED_MESSAGE.MANAGE_BATCHES,
      );
      expect(await t.prisma.ticketBatch.count()).toBe(1);
    });

    it('con "Tandas y precios", guardar el formulario con la info sin cambios cambia el precio', async () => {
      const s = await scenario(['MANAGE_BATCHES']);

      await put(
        s.member,
        `/events/${s.event.id}`,
        wholeForm(s, { batches: batchesWithPrice(s, 1500) }),
      ).expect(200);

      expect((await storedEvent(s)).ticketTypes[0].price.toNumber()).toBe(1500);
    });

    it('con "Tandas y precios", cambiar el título da 403', async () => {
      const s = await scenario(['MANAGE_BATCHES']);

      const res = await put(
        s.member,
        `/events/${s.event.id}`,
        wholeForm(s, { title: 'Otro título' }),
      ).expect(403);

      expect((res.body as { message: string }).message).toBe(
        DENIED_MESSAGE.EDIT_EVENT,
      );
    });

    it('publicar o pasar a borrador es solo del dueño', async () => {
      const s = await scenario(ALL_PERMISSIONS);

      const res = await put(s.member, `/events/${s.event.id}`, {
        status: 'DRAFT',
      }).expect(403);

      expect((res.body as { message: string }).message).toBe(
        'Solo quien organiza el evento puede publicarlo o pasarlo a borrador',
      );
      expect((await storedEvent(s)).status).toBe('PUBLISHED');
    });

    it('mandar el mismo estado que ya tiene no es un cambio', async () => {
      const s = await scenario(['EDIT_EVENT']);

      await put(s.member, `/events/${s.event.id}`, {
        title: 'Otro título',
        status: 'PUBLISHED',
      }).expect(200);
    });
  });

  describe('staff', () => {
    it('con "Staff y pagos" no puede invitar a otro co-organizador', async () => {
      const s = await scenario(['VIEW_SALES', 'MANAGE_STAFF']);

      const res = await post(s.member, `/events/${s.event.id}/staff`, {
        userId: s.invitee.id,
        role: 'MANAGER',
        permissions: ['VIEW_SALES'],
      }).expect(403);

      expect((res.body as { message: string }).message).toBe(
        'Solo quien organiza el evento puede invitar co-organizadores',
      );
      expect(
        await t.prisma.eventStaff.count({ where: { userId: s.invitee.id } }),
      ).toBe(0);
    });
  });

  describe('escanear', () => {
    it('cualquier co-organizador aceptado escanea, aunque no tenga permisos marcados', async () => {
      const s = await scenario([]);
      await t.prisma.event.update({
        where: { id: s.event.id },
        data: { startDate: new Date(Date.now() - HOUR_MS) },
      });
      const buyer = await createUser(t.prisma);
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType: s.ticketType,
        status: 'PAID',
      });
      const ticket = await createTicket(t.prisma, {
        order,
        ticketType: s.ticketType,
      });

      const res = await post(s.member, '/tickets/check-in', {
        qrCode: ticket.qrCode,
      }).expect(201);

      expect(res.body).toMatchObject({ success: true, status: 'VALID' });
    });
  });

  describe('qué ve del evento', () => {
    it('el dueño ve que tiene todos los permisos', async () => {
      const s = await scenario([]);

      const res = await get(
        s.organizer,
        `/events/organizer/${s.event.id}`,
      ).expect(200);

      expect((res.body as OrganizerEventView).access).toEqual({
        role: 'OWNER',
        permissions: ALL_PERMISSIONS,
        freeTicketLimit: null,
      });
    });

    it('el co-organizador ve sus permisos y su tope de QR free', async () => {
      const s = await scenario(['VIEW_SALES', 'SEND_FREE_TICKETS'], {
        freeTicketLimit: 5,
      });

      const res = await get(s.member, `/events/organizer/${s.event.id}`).expect(
        200,
      );

      expect((res.body as OrganizerEventView).access).toEqual({
        role: 'CO_ORGANIZER',
        permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
        freeTicketLimit: 5,
      });
    });

    it('sin "Ver ventas" ni "Tandas y precios" no ve cuántas entradas se vendieron o reservaron', async () => {
      const s = await scenario(['EDIT_EVENT']);

      const res = await get(s.member, `/events/organizer/${s.event.id}`).expect(
        200,
      );

      const body = res.body as OrganizerEventView;
      const types = [
        ...body.ticketTypes,
        ...body.ticketBatches.flatMap((batch) => batch.ticketTypes),
      ];
      expect(types).toHaveLength(2);
      for (const type of types) {
        expect(type).not.toHaveProperty('sold');
        expect(type).not.toHaveProperty('reserved');
      }
    });

    it.each(['VIEW_SALES', 'MANAGE_BATCHES'] as const)(
      'con %s ve lo vendido y reservado de cada entrada',
      async (permission) => {
        const s = await scenario([permission]);

        const res = await get(
          s.member,
          `/events/organizer/${s.event.id}`,
        ).expect(200);

        const body = res.body as OrganizerEventView;
        expect(body.ticketBatches[0].ticketTypes[0]).toMatchObject({
          sold: 0,
          reserved: 0,
        });
      },
    );
  });

  describe('QR free de un co-organizador', () => {
    function send(user: User, eventId: string, body: object) {
      return post(user, `/events/organizer/${eventId}/free-tickets`, body);
    }

    function sendTo(s: Scenario, quantity: number, email = 'a@example.com') {
      return send(s.member, s.event.id, {
        ticketTypeId: s.ticketType.id,
        quantity,
        email,
      });
    }

    it('ve solo los envíos que mandó; el dueño ve todos y quién mandó cada uno', async () => {
      const s = await scenario(['SEND_FREE_TICKETS']);
      await t.prisma.user.update({
        where: { id: s.organizer.id },
        data: { name: 'Dueña' },
      });
      await send(s.organizer, s.event.id, {
        ticketTypeId: s.ticketType.id,
        quantity: 1,
        email: 'del-dueno@example.com',
      }).expect(201);

      const mine = (
        await get(s.member, `/events/organizer/${s.event.id}/free-tickets`)
      ).body as Grant[];
      const all = (
        await get(s.organizer, `/events/organizer/${s.event.id}/free-tickets`)
      ).body as Grant[];

      expect(mine.map((grant) => grant.recipientEmail)).toEqual([
        'invitada@example.com',
      ]);
      expect(
        all.map(({ recipientEmail, issuedBy }) => [
          recipientEmail,
          issuedBy.name,
        ]),
      ).toEqual([
        ['del-dueno@example.com', 'Dueña'],
        ['invitada@example.com', 'Ana Pérez'],
      ]);
    });

    it.each(['cancel', 'resend'])(
      'no puede tocar (%s) un envío que mandó otro: 404',
      async (action) => {
        const s = await scenario(['SEND_FREE_TICKETS']);
        const res = await send(s.organizer, s.event.id, {
          ticketTypeId: s.ticketType.id,
          quantity: 1,
          email: 'del-dueno@example.com',
        }).expect(201);
        const ownerGrant = res.body as Grant;

        await post(
          s.member,
          `/events/organizer/${s.event.id}/free-tickets/${ownerGrant.id}/${action}`,
        ).expect(404);

        expect(
          await t.prisma.freeTicketGrant.findUniqueOrThrow({
            where: { id: ownerGrant.id },
          }),
        ).toMatchObject({ cancelledAt: null });
      },
    );

    it('el tope cuenta sus entradas no anuladas; anular un envío le devuelve lugar', async () => {
      // Already has one ticket sent (the scenario's grant).
      const s = await scenario(['SEND_FREE_TICKETS'], { freeTicketLimit: 4 });

      await sendTo(s, 2).expect(201);
      const over = await sendTo(s, 2).expect(409);
      expect((over.body as { message: string }).message).toBe(
        'Te queda 1 QR free para mandar en este evento (tu tope es 4)',
      );

      // The scenario's ticket was used: it keeps counting after cancelling.
      await t.prisma.ticket.updateMany({
        where: { freeTicketGrantId: s.grant.id },
        data: { status: 'USED' },
      });
      await post(
        s.member,
        `/events/organizer/${s.event.id}/free-tickets/${s.grant.id}/cancel`,
      ).expect(201);
      await sendTo(s, 1).expect(201);
      const full = await sendTo(s, 1).expect(409);
      expect((full.body as { message: string }).message).toBe(
        'Ya llegaste a tu tope de 4 QR free en este evento',
      );
    });

    it('los envíos que mandó el dueño no cuentan para el tope del co-organizador', async () => {
      const s = await scenario(['SEND_FREE_TICKETS'], { freeTicketLimit: 2 });
      await send(s.organizer, s.event.id, {
        ticketTypeId: s.ticketType.id,
        quantity: 10,
        email: 'del-dueno@example.com',
      }).expect(201);

      await sendTo(s, 1).expect(201);
    });

    it('dos envíos al mismo tiempo que juntos pasan el tope: uno entra y el otro da 409', async () => {
      const s = await scenario(['SEND_FREE_TICKETS'], { freeTicketLimit: 4 });

      const responses = await Promise.all([
        sendTo(s, 2, 'uno@example.com'),
        sendTo(s, 2, 'dos@example.com'),
      ]);

      expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(
        await t.prisma.ticket.count({
          where: { freeTicketGrant: { issuedById: s.member.id } },
        }),
      ).toBe(3);
    });

    it('sin tope puede mandar como el dueño', async () => {
      const s = await scenario(['SEND_FREE_TICKETS']);

      await sendTo(s, 10).expect(201);
      await sendTo(s, 10).expect(201);
    });
  });
});
