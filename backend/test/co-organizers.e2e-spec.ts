import { randomUUID } from 'crypto';
import request from 'supertest';
import { EventPermission, StaffStatus, User } from '@prisma/client';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type CoOrganizer = {
  id: string;
  status: string;
  name: string;
  email: string;
  permissions: string[];
  freeTicketLimit: number | null;
};

type ActivityPage = {
  items: {
    id: string;
    type: string;
    summary: string;
    actor: { name: string };
    createdAt: string;
  }[];
  total: number;
  page: number;
  limit: number;
};

describe('Co-organizadores', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  function invite(owner: User, eventId: string, body: Record<string, unknown>) {
    return request(server())
      .post(`/events/${eventId}/staff`)
      .set('Authorization', authHeader(t.app, owner))
      .send(body);
  }

  function list(user: User, eventId: string) {
    return request(server())
      .get(`/events/organizer/${eventId}/co-organizers`)
      .set('Authorization', authHeader(t.app, user));
  }

  function update(
    user: User,
    eventId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    return request(server())
      .put(`/events/organizer/${eventId}/co-organizers/${staffId}`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  function remove(user: User, eventId: string, staffId: string) {
    return request(server())
      .delete(`/events/organizer/${eventId}/co-organizers/${staffId}`)
      .set('Authorization', authHeader(t.app, user));
  }

  function activity(user: User, eventId: string, query = '') {
    return request(server())
      .get(`/events/organizer/${eventId}/activity${query}`)
      .set('Authorization', authHeader(t.app, user));
  }

  async function coOrganizer(
    eventId: string,
    {
      status = 'ACCEPTED',
      permissions = [],
      name = 'Ana Pérez',
      role = 'CUSTOMER',
    }: {
      status?: StaffStatus;
      permissions?: EventPermission[];
      name?: string;
      role?: User['role'];
    } = {},
  ) {
    const user = await createUser(t.prisma, { name, role });
    const staff = await t.prisma.eventStaff.create({
      data: { eventId, userId: user.id, role: 'MANAGER', status, permissions },
    });
    return { user, staff };
  }

  describe('invitar', () => {
    it('el dueño invita a una cuenta compradora con permisos y le llega la invitación con lo que va a poder hacer', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma, { name: 'Ana Pérez' });

      await invite(organizer, event.id, {
        userId: buyer.id,
        role: 'MANAGER',
        permissions: ['SEND_FREE_TICKETS', 'VIEW_SALES'],
        freeTicketLimit: 20,
      }).expect(201);

      const staff = await t.prisma.eventStaff.findFirstOrThrow({
        where: { eventId: event.id, userId: buyer.id },
      });
      expect(staff).toMatchObject({
        role: 'MANAGER',
        status: 'PENDING',
        permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
        freeTicketLimit: 20,
      });
      const notification = await t.prisma.notification.findFirstOrThrow({
        where: { userId: buyer.id },
      });
      expect(notification.message).toBe(
        `Te invitaron como co-organizador al evento "${event.title}". Vas a poder escanear, ver ventas y recaudación y mandar QR free (hasta 20 entradas).`,
      );
    });

    it('sin permisos marcados solo va a poder escanear', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      await invite(organizer, event.id, {
        userId: buyer.id,
        role: 'MANAGER',
      }).expect(201);

      const notification = await t.prisma.notification.findFirstOrThrow({
        where: { userId: buyer.id },
      });
      expect(notification.message).toBe(
        `Te invitaron como co-organizador al evento "${event.title}". Vas a poder escanear.`,
      );
    });

    it.each([
      ['pagos a RPPs sin ver ventas', { permissions: ['MANAGE_STAFF'] }],
      ['un permiso que no existe', { permissions: ['CANCEL_EVENT'] }],
      ['permisos repetidos', { permissions: ['VIEW_SALES', 'VIEW_SALES'] }],
      [
        'un tope de QR free de 0',
        { permissions: ['SEND_FREE_TICKETS'], freeTicketLimit: 0 },
      ],
      [
        'un tope de QR free con decimales',
        { permissions: ['SEND_FREE_TICKETS'], freeTicketLimit: 2.5 },
      ],
    ])('rechaza la invitación con %s', async (_case, body) => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      await invite(organizer, event.id, {
        userId: buyer.id,
        role: 'MANAGER',
        ...body,
      }).expect(400);

      expect(await t.prisma.eventStaff.count()).toBe(0);
    });

    it('el tope de QR free sin el permiso de QR free no se guarda', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      await invite(organizer, event.id, {
        userId: buyer.id,
        role: 'MANAGER',
        permissions: ['VIEW_SALES'],
        freeTicketLimit: 10,
      }).expect(201);

      const staff = await t.prisma.eventStaff.findFirstOrThrow({
        where: { userId: buyer.id },
      });
      expect(staff.freeTicketLimit).toBeNull();
    });

    it('a un scanner no se le guardan permisos', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      await invite(organizer, event.id, {
        userId: buyer.id,
        role: 'SCANNER',
        permissions: ['VIEW_SALES'],
      }).expect(201);

      const staff = await t.prisma.eventStaff.findFirstOrThrow({
        where: { userId: buyer.id },
      });
      expect(staff.permissions).toEqual([]);
    });

    it('reinvitar a quien rechazó guarda los permisos nuevos', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await coOrganizer(event.id, {
        status: 'REJECTED',
        permissions: ['VIEW_SALES'],
      });

      await invite(organizer, event.id, {
        userId: user.id,
        role: 'MANAGER',
        permissions: ['EDIT_EVENT'],
      }).expect(201);

      expect(
        await t.prisma.eventStaff.findUniqueOrThrow({
          where: { id: staff.id },
        }),
      ).toMatchObject({ status: 'PENDING', permissions: ['EDIT_EVENT'] });
    });

    it('cada invitación queda en el historial del evento', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const ana = await createUser(t.prisma, { name: 'Ana Pérez' });
      const bruno = await createUser(t.prisma, { name: 'Bruno Díaz' });
      const carla = await createUser(t.prisma, { name: 'Carla Gómez' });

      await invite(organizer, event.id, {
        userId: ana.id,
        role: 'MANAGER',
        permissions: ['VIEW_SALES'],
      }).expect(201);
      await invite(organizer, event.id, {
        userId: bruno.id,
        role: 'SCANNER',
      }).expect(201);
      await invite(organizer, event.id, {
        userId: carla.id,
        role: 'PROMOTER',
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
      }).expect(201);

      const res = await activity(organizer, event.id).expect(200);

      const page = res.body as ActivityPage;
      expect(
        page.items.map(({ type, summary, actor }) => ({
          type,
          summary,
          actor: actor.name,
        })),
      ).toEqual([
        {
          type: 'STAFF_INVITED',
          summary:
            'Invitó a Carla Gómez como promotor (RPP), con 10% de comisión por entrada.',
          actor: organizer.name,
        },
        {
          type: 'STAFF_INVITED',
          summary: 'Invitó a Bruno Díaz como scanner.',
          actor: organizer.name,
        },
        {
          type: 'CO_ORGANIZER_INVITED',
          summary:
            'Invitó a Ana Pérez a co-organizar. Va a poder escanear y ver ventas y recaudación.',
          actor: organizer.name,
        },
      ]);
    });

    it('si no se puede guardar en el historial, la invitación tampoco queda', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);
      await t.prisma.$executeRawUnsafe(
        'ALTER TABLE "EventActivity" ADD CONSTRAINT "test_no_activity" CHECK (false) NOT VALID',
      );
      try {
        await invite(organizer, event.id, {
          userId: buyer.id,
          role: 'MANAGER',
        }).expect(500);
      } finally {
        await t.prisma.$executeRawUnsafe(
          'ALTER TABLE "EventActivity" DROP CONSTRAINT "test_no_activity"',
        );
      }

      expect(await t.prisma.eventStaff.count()).toBe(0);
      expect(await t.prisma.notification.count()).toBe(0);
    });
  });

  describe('ver y cambiar permisos', () => {
    it('el dueño ve a sus co-organizadores con su estado y sus permisos, sin el resto del staff', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const pending = await coOrganizer(event.id, {
        status: 'PENDING',
        name: 'Bruno Díaz',
      });
      const accepted = await coOrganizer(event.id, {
        name: 'Ana Pérez',
        permissions: ['VIEW_SALES'],
      });
      const scanner = await createUser(t.prisma);
      await t.prisma.eventStaff.create({
        data: { eventId: event.id, userId: scanner.id, role: 'SCANNER' },
      });

      const res = await list(organizer, event.id).expect(200);

      expect(res.body as CoOrganizer[]).toEqual([
        {
          id: accepted.staff.id,
          status: 'ACCEPTED',
          name: 'Ana Pérez',
          email: accepted.user.email,
          permissions: ['VIEW_SALES'],
          freeTicketLimit: null,
        },
        {
          id: pending.staff.id,
          status: 'PENDING',
          name: 'Bruno Díaz',
          email: pending.user.email,
          permissions: [],
          freeTicketLimit: null,
        },
      ]);
    });

    it('cambiar los permisos aplica en el momento y queda en el historial', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await coOrganizer(event.id, {
        permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
      });

      const res = await update(organizer, event.id, staff.id, {
        permissions: ['VIEW_ATTENDEES', 'SEND_FREE_TICKETS'],
        freeTicketLimit: 5,
      }).expect(200);

      expect(res.body as CoOrganizer).toMatchObject({
        permissions: ['SEND_FREE_TICKETS', 'VIEW_ATTENDEES'],
        freeTicketLimit: 5,
      });
      expect(
        await t.prisma.eventStaff.findUniqueOrThrow({
          where: { id: staff.id },
        }),
      ).toMatchObject({
        permissions: ['SEND_FREE_TICKETS', 'VIEW_ATTENDEES'],
        freeTicketLimit: 5,
      });
      const history = (await activity(organizer, event.id).expect(200))
        .body as ActivityPage;
      expect(history.items[0]).toMatchObject({
        type: 'CO_ORGANIZER_UPDATED',
        summary:
          'Cambió los permisos de Ana Pérez. Ahora puede escanear, mandar QR free (hasta 5 entradas) y ver y exportar asistentes.',
      });
    });

    it('cambiar a pagos a RPPs sin ver ventas da 400 y no cambia nada', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await coOrganizer(event.id, {
        permissions: ['VIEW_SALES'],
      });

      await update(organizer, event.id, staff.id, {
        permissions: ['MANAGE_STAFF'],
      }).expect(400);

      expect(
        (
          await t.prisma.eventStaff.findUniqueOrThrow({
            where: { id: staff.id },
          })
        ).permissions,
      ).toEqual(['VIEW_SALES']);
    });

    it('cambiar a alguien que no es co-organizador del evento da 404', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const scanner = await createUser(t.prisma);
      const scannerStaff = await t.prisma.eventStaff.create({
        data: { eventId: event.id, userId: scanner.id, role: 'SCANNER' },
      });
      const other = await createOrganizerWithEvent(t.prisma);
      const otherCoOrganizer = await coOrganizer(other.event.id);

      for (const id of [
        scannerStaff.id,
        otherCoOrganizer.staff.id,
        randomUUID(),
      ]) {
        await update(organizer, event.id, id, { permissions: [] }).expect(404);
        await remove(organizer, event.id, id).expect(404);
      }
    });
  });

  describe('quitar', () => {
    it('quitar a un co-organizador borra su invitación y queda en el historial', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await coOrganizer(event.id);

      await remove(organizer, event.id, staff.id).expect(200);

      expect(
        await t.prisma.eventStaff.findUnique({ where: { id: staff.id } }),
      ).toBeNull();
      const history = (await activity(organizer, event.id).expect(200))
        .body as ActivityPage;
      expect(history.items[0]).toMatchObject({
        type: 'CO_ORGANIZER_REMOVED',
        summary: 'Quitó a Ana Pérez de los co-organizadores.',
      });
    });
  });

  describe('solo el dueño', () => {
    const requests = [
      ['ver los co-organizadores', 'list'],
      ['cambiar permisos', 'update'],
      ['quitar a un co-organizador', 'remove'],
      ['ver el historial', 'activity'],
    ] as const;

    function attempt(
      user: User,
      eventId: string,
      staffId: string,
      what: (typeof requests)[number][1],
    ) {
      if (what === 'list') return list(user, eventId);
      if (what === 'update') {
        return update(user, eventId, staffId, { permissions: ['VIEW_SALES'] });
      }
      if (what === 'remove') return remove(user, eventId, staffId);
      return activity(user, eventId);
    }

    it.each(requests)(
      'un co-organizador aceptado, aunque maneje el staff, no puede %s',
      async (_case, what) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const { staff } = await coOrganizer(event.id, {
          permissions: ['VIEW_SALES', 'MANAGE_STAFF'],
          role: 'ORGANIZER',
        });
        const partner = await t.prisma.user.findUniqueOrThrow({
          where: { id: staff.userId },
        });

        await attempt(partner, event.id, staff.id, what).expect(403);

        expect(
          (
            await t.prisma.eventStaff.findUniqueOrThrow({
              where: { id: staff.id },
            })
          ).permissions,
        ).toEqual(['VIEW_SALES', 'MANAGE_STAFF']);
      },
    );

    it.each(requests)(
      'otro organizador o alguien con la invitación pendiente no encuentra el evento al %s',
      async (_case, what) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const { staff } = await coOrganizer(event.id);
        const stranger = await createUser(t.prisma, { role: 'ORGANIZER' });
        const pending = await coOrganizer(event.id, {
          status: 'PENDING',
          role: 'ORGANIZER',
        });

        await attempt(stranger, event.id, staff.id, what).expect(404);
        await attempt(pending.user, event.id, staff.id, what).expect(404);
      },
    );

    it('sin sesión no se puede ver el historial', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      await request(server())
        .get(`/events/organizer/${event.id}/activity`)
        .expect(401);
    });
  });

  describe('historial', () => {
    it('muestra lo más nuevo primero, con quién lo hizo, de a 50', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const start = Date.now() - 60 * 60 * 1000;
      await t.prisma.eventActivity.createMany({
        data: Array.from({ length: 51 }, (_, i) => ({
          eventId: event.id,
          actorId: organizer.id,
          type: 'STAFF_INVITED' as const,
          summary: `Cambio ${i + 1}`,
          createdAt: new Date(start + i * 1000),
        })),
      });

      const first = (await activity(organizer, event.id).expect(200))
        .body as ActivityPage;
      const second = (
        await activity(organizer, event.id, '?page=2').expect(200)
      ).body as ActivityPage;

      expect(first).toMatchObject({ total: 51, page: 1, limit: 50 });
      expect(first.items).toHaveLength(50);
      expect(first.items[0]).toMatchObject({
        summary: 'Cambio 51',
        actor: { name: organizer.name },
      });
      expect(second.items.map((item) => item.summary)).toEqual(['Cambio 1']);
    });

    it('una página inválida da 400', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await activity(organizer, event.id, '?page=0').expect(400);
    });

    it('no mezcla el historial de otros eventos', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const other = await createOrganizerWithEvent(t.prisma);
      await t.prisma.eventActivity.create({
        data: {
          eventId: other.event.id,
          actorId: other.organizer.id,
          type: 'STAFF_INVITED',
          summary: 'De otro evento',
        },
      });

      const res = await activity(organizer, event.id).expect(200);

      expect((res.body as ActivityPage).total).toBe(0);
    });
  });
});
