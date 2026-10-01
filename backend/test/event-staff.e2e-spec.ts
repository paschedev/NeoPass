import { randomUUID } from 'crypto';
import request from 'supertest';
import { StaffRole, StaffStatus, User } from '@prisma/client';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('staff de un evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function invite(
    organizer: User,
    eventId: string,
    userId: string,
    role: StaffRole = 'SCANNER',
  ) {
    return request(t.app.getHttpServer())
      .post(`/events/${eventId}/staff`)
      .set('Authorization', authHeader(t.app, organizer))
      .send(
        role === 'PROMOTER'
          ? { userId, role, commissionType: 'PERCENTAGE', commissionValue: 10 }
          : { userId, role },
      );
  }

  function invitePromoter(
    organizer: User,
    eventId: string,
    userId: string,
    commission: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .post(`/events/${eventId}/staff`)
      .set('Authorization', authHeader(t.app, organizer))
      .send({ userId, role: 'PROMOTER', ...commission });
  }

  function listStaff(organizer: User, eventId: string) {
    return request(t.app.getHttpServer())
      .get(`/events/${eventId}/staff`)
      .set('Authorization', authHeader(t.app, organizer));
  }

  function respond(
    user: User,
    eventStaffId: string,
    action: 'accept' | 'reject',
  ) {
    return request(t.app.getHttpServer())
      .put(`/events/staff/${eventStaffId}/${action}`)
      .set('Authorization', authHeader(t.app, user));
  }

  async function addStaff(
    eventId: string,
    status: StaffStatus = 'PENDING',
    role: StaffRole = 'SCANNER',
  ) {
    const user = await createUser(t.prisma);
    const staff = await t.prisma.eventStaff.create({
      data: { eventId, userId: user.id, role, status },
    });
    return { user, staff };
  }

  async function staffStatus(id: string) {
    const staff = await t.prisma.eventStaff.findUniqueOrThrow({
      where: { id },
    });
    return staff.status;
  }

  describe('invitar', () => {
    it('la invitación queda pendiente y al invitado le llega el aviso', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const invitee = await createUser(t.prisma);

      await invite(organizer, event.id, invitee.id, 'PROMOTER').expect(201);

      const staff = await t.prisma.eventStaff.findFirstOrThrow({
        where: { eventId: event.id, userId: invitee.id },
      });
      expect(staff).toMatchObject({ role: 'PROMOTER', status: 'PENDING' });
      const notifications = await t.prisma.notification.findMany({
        where: { userId: invitee.id },
      });
      expect(notifications).toEqual([
        expect.objectContaining({ type: 'STAFF_INVITE', eventId: event.id }),
      ]);
    });

    it.each([
      ['PROMOTER', 'promotor (RPP)', ', con 10% de comisión por entrada.'],
      ['SCANNER', 'scanner', '.'],
      ['MANAGER', 'encargado', '.'],
    ] as const)(
      'el aviso al invitado como %s nombra el rol en español',
      async (role, label, ending) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);
        const invitee = await createUser(t.prisma);

        await invite(organizer, event.id, invitee.id, role).expect(201);

        const notification = await t.prisma.notification.findFirstOrThrow({
          where: { userId: invitee.id },
        });
        expect(notification).toMatchObject({
          title: 'Nueva invitación',
          message: `Te invitaron como ${label} al evento "${event.title}"${ending}`,
        });
      },
    );

    it('no puede invitar a un evento ajeno', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);
      const other = await createOrganizerWithEvent(t.prisma);
      const invitee = await createUser(t.prisma);

      await invite(organizer, other.event.id, invitee.id).expect(403);
    });

    it('invitar a un evento que no existe da 404', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);
      const invitee = await createUser(t.prisma);

      await invite(organizer, randomUUID(), invitee.id).expect(404);
    });

    it('invitar a alguien que no está registrado da 404', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await invite(organizer, event.id, randomUUID()).expect(404);
    });

    it('invitar a un usuario con un ID mal formado da 400', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      const res = await invite(organizer, event.id, 'no-es-un-uuid').expect(
        400,
      );

      expect((res.body as { message: string[] }).message).toEqual([
        'Elegí a quién invitar',
      ]);
    });

    it.each([
      [
        'un porcentaje mayor a 100',
        { commissionType: 'PERCENTAGE', commissionValue: 100.1 },
        'El porcentaje de comisión tiene que estar entre 0 y 100',
      ],
      [
        'un porcentaje negativo',
        { commissionType: 'PERCENTAGE', commissionValue: -1 },
        'La comisión no puede ser negativa',
      ],
      [
        'un monto fijo negativo',
        { commissionType: 'FIXED', commissionValue: -1 },
        'La comisión no puede ser negativa',
      ],
      [
        'un monto fijo de más de $99.999.999,99',
        { commissionType: 'FIXED', commissionValue: 100_000_000 },
        'La comisión máxima es $99.999.999,99',
      ],
    ])(
      'no invita a un promotor con %s de comisión',
      async (_case, commission, message) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);
        const invitee = await createUser(t.prisma);

        const res = await invitePromoter(
          organizer,
          event.id,
          invitee.id,
          commission,
        ).expect(400);

        // Un solo motivo, venga de la validación (lista) o de la regla (texto).
        const body = res.body as { message: string | string[] };
        expect([body.message].flat()).toEqual([message]);
        expect(await t.prisma.eventStaff.count()).toBe(0);
        expect(await t.prisma.notification.count()).toBe(0);
      },
    );

    it.each([
      ['el 100 %', { commissionType: 'PERCENTAGE', commissionValue: 100 }],
      [
        'un monto fijo de $99.999.999,99',
        { commissionType: 'FIXED', commissionValue: 99_999_999.99 },
      ],
    ])('invita a un promotor con %s de comisión', async (_case, commission) => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const invitee = await createUser(t.prisma);

      await invitePromoter(organizer, event.id, invitee.id, commission).expect(
        201,
      );

      const staff = await t.prisma.eventStaff.findFirstOrThrow();
      expect(staff.commissionType).toBe(commission.commissionType);
      expect(Number(staff.commissionValue)).toBe(commission.commissionValue);
    });

    it.each(['SCANNER', 'MANAGER'] as const)(
      'la comisión solo vale para promotores: a un %s se le ignora',
      async (role) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);
        const invitee = await createUser(t.prisma);

        await request(t.app.getHttpServer())
          .post(`/events/${event.id}/staff`)
          .set('Authorization', authHeader(t.app, organizer))
          .send({
            userId: invitee.id,
            role,
            commissionType: 'CUALQUIERA',
            commissionValue: 'mucho',
          })
          .expect(201);

        const staff = await t.prisma.eventStaff.findFirstOrThrow();
        expect(staff).toMatchObject({
          role,
          commissionType: null,
          commissionValue: null,
        });
      },
    );

    it.each([
      [
        'PENDING',
        'SCANNER',
        'El usuario ya tiene una invitación pendiente como scanner en este evento.',
      ],
      ['ACCEPTED', 'SCANNER', 'El usuario ya es scanner de este evento.'],
      ['ACCEPTED', 'PROMOTER', 'El usuario ya es promotor de este evento.'],
    ] as const)(
      'no vuelve a invitar a quien tiene una invitación %s como %s, y lo explica con el rol en español',
      async (status, role, message) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);
        const { user } = await addStaff(event.id, status, role);

        const res = await invite(organizer, event.id, user.id, role).expect(
          409,
        );

        expect((res.body as { message: string }).message).toBe(message);
      },
    );

    it('vuelve a invitar a quien había rechazado', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id, 'REJECTED');

      await invite(organizer, event.id, user.id).expect(201);

      expect(await staffStatus(staff.id)).toBe('PENDING');
      const notification = await t.prisma.notification.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(notification.message).toBe(
        `Te invitaron de nuevo como scanner al evento "${event.title}".`,
      );
    });
  });

  describe('ver el staff', () => {
    it('el organizador ve el staff de su evento', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id);

      const res = await listStaff(organizer, event.id).expect(200);

      expect((res.body as { id: string }[]).map((s) => s.id)).toEqual([
        staff.id,
      ]);
    });

    it('no puede ver el staff de un evento ajeno', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);
      const other = await createOrganizerWithEvent(t.prisma);

      await listStaff(organizer, other.event.id).expect(403);
    });

    it('un evento que no existe da 404', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await listStaff(organizer, randomUUID()).expect(404);
    });
  });

  describe('responder una invitación', () => {
    it('al aceptarla queda aceptada y el organizador recibe el aviso', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id);

      await respond(user, staff.id, 'accept').expect(200);

      expect(await staffStatus(staff.id)).toBe('ACCEPTED');
      const notifications = await t.prisma.notification.findMany({
        where: { userId: organizer.id },
      });
      expect(notifications).toEqual([
        expect.objectContaining({
          title: 'Invitación aceptada',
          message: `${user.name} aceptó tu invitación para ser scanner en "${event.title}".`,
        }),
      ]);
    });

    it('si un promotor la rechaza, el organizador recibe el aviso con el rol en español', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id, 'PENDING', 'PROMOTER');

      await respond(user, staff.id, 'reject').expect(200);

      const notification = await t.prisma.notification.findFirstOrThrow({
        where: { userId: organizer.id },
      });
      expect(notification).toMatchObject({
        title: 'Invitación rechazada',
        message: `${user.name} rechazó tu invitación para ser promotor en "${event.title}".`,
      });
    });

    it('al rechazarla queda rechazada', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id);

      await respond(user, staff.id, 'reject').expect(200);

      expect(await staffStatus(staff.id)).toBe('REJECTED');
    });

    it.each(['accept', 'reject'] as const)(
      'no puede responder (%s) la invitación de otro usuario',
      async (action) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const { staff } = await addStaff(event.id);
        const intruder = await createUser(t.prisma);

        await respond(intruder, staff.id, action).expect(404);

        expect(await staffStatus(staff.id)).toBe('PENDING');
      },
    );

    it.each(['accept', 'reject'] as const)(
      'responder (%s) una invitación que no existe da 404',
      async (action) => {
        const user = await createUser(t.prisma);

        await respond(user, randomUUID(), action).expect(404);
      },
    );

    it.each(['accept', 'reject'] as const)(
      'una invitación ya respondida no se puede volver a responder (%s)',
      async (action) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const { user, staff } = await addStaff(event.id, 'ACCEPTED');

        await respond(user, staff.id, action).expect(409);

        expect(await staffStatus(staff.id)).toBe('ACCEPTED');
      },
    );

    it('si llegan dos respuestas a la vez, cuenta una sola', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id);

      const results = await Promise.all([
        respond(user, staff.id, 'accept'),
        respond(user, staff.id, 'accept'),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
      const notifications = await t.prisma.notification.findMany({
        where: { userId: organizer.id },
      });
      expect(notifications).toHaveLength(1);
    });
  });
});
