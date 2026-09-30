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

    it.each(['PENDING', 'ACCEPTED'] as const)(
      'no vuelve a invitar a quien tiene una invitación %s para ese rol',
      async (status) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);
        const { user } = await addStaff(event.id, status);

        await invite(organizer, event.id, user.id).expect(409);
      },
    );

    it('vuelve a invitar a quien había rechazado', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const { user, staff } = await addStaff(event.id, 'REJECTED');

      await invite(organizer, event.id, user.id).expect(201);

      expect(await staffStatus(staff.id)).toBe('PENDING');
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
      expect(notifications).toHaveLength(1);
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
