import request from 'supertest';
import { EventPermission, User } from '@prisma/client';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;

const ALL: EventPermission[] = [
  'EDIT_EVENT',
  'MANAGE_BATCHES',
  'VIEW_SALES',
  'SEND_FREE_TICKETS',
  'VIEW_ATTENDEES',
  'MANAGE_STAFF',
];

describe('Historial del evento: cada cambio queda con quién lo hizo', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  // An owner's event with a co-organizer who can do everything, a promoter
  // with 5000 to be paid and a grant of 2 free tickets the co-organizer sent
  // an hour ago.
  async function scenario(permissions: EventPermission[] = ALL) {
    const created = await createOrganizerWithEvent(t.prisma);
    const { event, ticketType } = created;
    await t.prisma.user.update({
      where: { id: created.organizer.id },
      data: { name: 'Dueña' },
    });
    const member = await createUser(t.prisma, { name: 'Ana Pérez' });
    await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: member.id,
        role: 'MANAGER',
        status: 'ACCEPTED',
        permissions,
      },
    });
    const promoter = await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: (await createUser(t.prisma, { name: 'Carla Gómez' })).id,
        role: 'PROMOTER',
        status: 'ACCEPTED',
        totalEarned: 5000,
      },
    });
    const grant = await t.prisma.freeTicketGrant.create({
      data: {
        eventId: event.id,
        ticketTypeId: ticketType.id,
        issuedById: member.id,
        recipientEmail: 'invitada@example.com',
        lastSentAt: new Date(Date.now() - HOUR_MS),
        tickets: {
          create: [
            { ticketTypeId: ticketType.id, isGuestList: true },
            { ticketTypeId: ticketType.id, isGuestList: true },
          ],
        },
      },
    });
    return { ...created, member, promoter, grant };
  }

  type Scenario = Awaited<ReturnType<typeof scenario>>;

  function call(
    user: User,
    method: 'put' | 'post',
    path: string,
    body: object = {},
  ) {
    return request(server())
      [method](path)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  async function history(eventId: string) {
    const rows = await t.prisma.eventActivity.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      select: { type: true, summary: true, actor: { select: { name: true } } },
    });
    return rows.map(({ type, summary, actor }) => ({
      type,
      summary,
      actor: actor.name,
    }));
  }

  // The batch as stored, changing only the price.
  function batchesWithPrice(s: Scenario, price: number) {
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

  // What the edit form sends: every field, the batches included.
  function wholeForm(s: Scenario, changes: Record<string, unknown> = {}) {
    return {
      title: s.event.title,
      description: s.event.description,
      startDate: s.event.startDate.toISOString(),
      endDate: s.event.endDate.toISOString(),
      batches: batchesWithPrice(s, 1000),
      ...changes,
    };
  }

  describe('editar el evento', () => {
    it('cuenta qué cambió de la info', async () => {
      const s = await scenario();

      await call(
        s.organizer,
        'put',
        `/events/${s.event.id}`,
        wholeForm(s, {
          title: 'Fiesta de fin de año',
          endDate: new Date(s.event.endDate.getTime() + HOUR_MS).toISOString(),
        }),
      ).expect(200);

      expect(await history(s.event.id)).toEqual([
        {
          type: 'EVENT_UPDATED',
          summary: 'Editó el título y la fecha de fin.',
          actor: 'Dueña',
        },
      ]);
    });

    it.each([
      ['PUBLISHED', 'DRAFT', 'Pasó el evento a borrador.'],
      ['DRAFT', 'PUBLISHED', 'Publicó el evento.'],
    ] as const)(
      'pasar de %s a %s queda en el historial',
      async (from, to, summary) => {
        const s = await scenario();
        await t.prisma.event.update({
          where: { id: s.event.id },
          data: { status: from },
        });

        await call(s.organizer, 'put', `/events/${s.event.id}`, {
          status: to,
        }).expect(200);

        expect(await history(s.event.id)).toEqual([
          { type: 'EVENT_UPDATED', summary, actor: 'Dueña' },
        ]);
      },
    );

    it('un co-organizador cambia un precio desde el formulario: queda a su nombre, con el antes y el después', async () => {
      const s = await scenario(['MANAGE_BATCHES']);

      await call(
        s.member,
        'put',
        `/events/${s.event.id}`,
        wholeForm(s, { batches: batchesWithPrice(s, 1500) }),
      ).expect(200);

      expect(await history(s.event.id)).toEqual([
        {
          type: 'BATCHES_UPDATED',
          summary:
            'Cambió el precio de "General" en "Preventa" de $1.000 a $1.500.',
          actor: 'Ana Pérez',
        },
      ]);
    });

    it('si cambia la info y las tandas en el mismo guardado, quedan las dos cosas', async () => {
      const s = await scenario();

      await call(
        s.member,
        'put',
        `/events/${s.event.id}`,
        wholeForm(s, {
          title: 'Otro título',
          batches: [
            ...batchesWithPrice(s, 1000),
            {
              name: 'VIP',
              isVisible: true,
              ticketTypes: [{ name: 'Mesa', price: 20000, stock: 10 }],
            },
          ],
        }),
      ).expect(200);

      // Same transaction, same time: their order is not defined.
      const entries = await history(s.event.id);
      expect(entries).toHaveLength(2);
      expect(entries).toEqual(
        expect.arrayContaining([
          {
            type: 'EVENT_UPDATED',
            summary: 'Editó el título.',
            actor: 'Ana Pérez',
          },
          {
            type: 'BATCHES_UPDATED',
            summary: 'Creó la tanda "VIP" con "Mesa" a $20.000.',
            actor: 'Ana Pérez',
          },
        ]),
      );
    });

    it('guardar el formulario sin cambios no deja nada', async () => {
      const s = await scenario();

      await call(s.member, 'put', `/events/${s.event.id}`, wholeForm(s)).expect(
        200,
      );

      expect(await history(s.event.id)).toEqual([]);
    });

    it('cambiar las tandas por su ruta también queda', async () => {
      const s = await scenario();

      await call(s.member, 'put', `/events/${s.event.id}/batches`, {
        batches: batchesWithPrice(s, 800),
      }).expect(200);

      expect(await history(s.event.id)).toEqual([
        {
          type: 'BATCHES_UPDATED',
          summary:
            'Cambió el precio de "General" en "Preventa" de $1.000 a $800.',
          actor: 'Ana Pérez',
        },
      ]);
    });
  });

  describe('venta de una tanda', () => {
    it.each([
      ['END', {}, 'Finalizó la venta de "Preventa".'],
      [
        'REOPEN',
        { closeAt: new Date(Date.now() - HOUR_MS) },
        'Reabrió la venta de "Preventa".',
      ],
      ['HIDE', {}, 'Ocultó la tanda "Preventa".'],
      ['SHOW', { isVisible: false }, 'Mostró la tanda "Preventa".'],
    ] as const)('%s queda en el historial', async (action, batch, summary) => {
      const s = await scenario();
      await t.prisma.ticketBatch.update({
        where: { id: s.batch.id },
        data: batch,
      });

      await call(
        s.member,
        'put',
        `/events/${s.event.id}/batches/${s.batch.id}/sale`,
        { action },
      ).expect(200);

      expect(await history(s.event.id)).toEqual([
        { type: 'BATCH_SALE_CHANGED', summary, actor: 'Ana Pérez' },
      ]);
    });
  });

  describe('QR free', () => {
    it('mandar, anular y reenviar quedan con a quién', async () => {
      const s = await scenario();
      const freeTickets = `/events/organizer/${s.event.id}/free-tickets`;

      await call(s.member, 'post', freeTickets, {
        ticketTypeId: s.ticketType.id,
        quantity: 3,
        email: 'otra@example.com',
      }).expect(201);
      await call(
        s.member,
        'post',
        `${freeTickets}/${s.grant.id}/resend`,
      ).expect(201);
      await call(
        s.organizer,
        'post',
        `${freeTickets}/${s.grant.id}/cancel`,
      ).expect(201);

      expect(await history(s.event.id)).toEqual([
        {
          type: 'FREE_TICKETS_SENT',
          summary: 'Mandó 3 QR free de "General" a otra@example.com.',
          actor: 'Ana Pérez',
        },
        {
          type: 'FREE_TICKETS_RESENT',
          summary: 'Reenvió los QR free de invitada@example.com.',
          actor: 'Ana Pérez',
        },
        {
          type: 'FREE_TICKETS_CANCELLED',
          summary: 'Anuló el envío de 2 QR free a invitada@example.com.',
          actor: 'Dueña',
        },
      ]);
    });
  });

  describe('pagos a RPPs', () => {
    it('registrar un pago queda con el monto y a quién', async () => {
      const s = await scenario();

      await call(
        s.member,
        'post',
        `/events/organizer/${s.event.id}/promoters/${s.promoter.id}/payments`,
        { amount: 1500.5 },
      ).expect(201);

      expect(await history(s.event.id)).toEqual([
        {
          type: 'PROMOTER_PAYMENT_REGISTERED',
          summary: 'Registró un pago de $1.500,50 a Carla Gómez.',
          actor: 'Ana Pérez',
        },
      ]);
    });
  });

  describe('si el historial no se puede guardar, el cambio tampoco queda', () => {
    const changes: [
      string,
      (s: Scenario) => request.Test,
      (s: Scenario) => Promise<void>,
    ][] = [
      [
        'editar la info',
        (s) =>
          call(s.member, 'put', `/events/${s.event.id}`, {
            title: 'Otro título',
          }),
        async (s) => {
          const event = await t.prisma.event.findUniqueOrThrow({
            where: { id: s.event.id },
          });
          expect(event.title).toBe(s.event.title);
        },
      ],
      [
        'cambiar las tandas',
        (s) =>
          call(s.member, 'put', `/events/${s.event.id}/batches`, {
            batches: batchesWithPrice(s, 1500),
          }),
        async (s) => {
          const type = await t.prisma.ticketType.findUniqueOrThrow({
            where: { id: s.ticketType.id },
          });
          expect(type.price.toNumber()).toBe(1000);
        },
      ],
      [
        'finalizar la venta de una tanda',
        (s) =>
          call(
            s.member,
            'put',
            `/events/${s.event.id}/batches/${s.batch.id}/sale`,
            { action: 'END' },
          ),
        async (s) => {
          const batch = await t.prisma.ticketBatch.findUniqueOrThrow({
            where: { id: s.batch.id },
          });
          expect(batch.closeAt).toBeNull();
        },
      ],
      [
        'mandar QR free',
        (s) =>
          call(
            s.member,
            'post',
            `/events/organizer/${s.event.id}/free-tickets`,
            {
              ticketTypeId: s.ticketType.id,
              quantity: 1,
              email: 'otra@example.com',
            },
          ),
        async () => {
          expect(await t.prisma.freeTicketGrant.count()).toBe(1);
          expect(t.queues.mail.add).not.toHaveBeenCalled();
        },
      ],
      [
        'anular un envío de QR free',
        (s) =>
          call(
            s.member,
            'post',
            `/events/organizer/${s.event.id}/free-tickets/${s.grant.id}/cancel`,
          ),
        async (s) => {
          const grant = await t.prisma.freeTicketGrant.findUniqueOrThrow({
            where: { id: s.grant.id },
          });
          expect(grant.cancelledAt).toBeNull();
          expect(
            await t.prisma.ticket.count({ where: { status: 'VALID' } }),
          ).toBe(2);
        },
      ],
      [
        'reenviar un envío de QR free',
        (s) =>
          call(
            s.member,
            'post',
            `/events/organizer/${s.event.id}/free-tickets/${s.grant.id}/resend`,
          ),
        async (s) => {
          const grant = await t.prisma.freeTicketGrant.findUniqueOrThrow({
            where: { id: s.grant.id },
          });
          expect(grant.lastSentAt).toEqual(s.grant.lastSentAt);
          expect(t.queues.mail.add).not.toHaveBeenCalled();
        },
      ],
      [
        'registrar un pago a un RPP',
        (s) =>
          call(
            s.member,
            'post',
            `/events/organizer/${s.event.id}/promoters/${s.promoter.id}/payments`,
            { amount: 100 },
          ),
        async (s) => {
          expect(await t.prisma.promoterPayment.count()).toBe(0);
          const promoter = await t.prisma.eventStaff.findUniqueOrThrow({
            where: { id: s.promoter.id },
          });
          expect(promoter.totalPaid.toNumber()).toBe(0);
        },
      ],
    ];

    it.each(changes)('%s', async (_case, change, unchanged) => {
      const s = await scenario();
      t.queues.mail.add.mockClear();
      await t.prisma.$executeRawUnsafe(
        'ALTER TABLE "EventActivity" ADD CONSTRAINT "test_no_activity" CHECK (false) NOT VALID',
      );
      try {
        await change(s).expect(500);
      } finally {
        await t.prisma.$executeRawUnsafe(
          'ALTER TABLE "EventActivity" DROP CONSTRAINT "test_no_activity"',
        );
      }

      await unchanged(s);
    });
  });
});
