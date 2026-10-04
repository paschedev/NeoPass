import request from 'supertest';
import { StaffRole, StaffStatus, User } from '@prisma/client';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MyStaff = {
  promoterTotals: {
    totalEarned: number;
    totalPaid: number;
    owed: number;
    ticketsSold: number;
  } | null;
  invitations: { id: string; role: StaffRole; event: { id: string } }[];
  events: {
    id: string;
    organizerName: string;
    venueName: string | null;
    phase: string;
    roles: StaffRole[];
    promoter: { staffId: string; ticketsSold: number } | null;
  }[];
};

describe('Staff: los eventos donde trabaja cada uno', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function addStaff(
    eventId: string,
    user: User,
    role: StaffRole,
    status: StaffStatus = 'ACCEPTED',
  ) {
    return t.prisma.eventStaff.create({
      data: {
        eventId,
        userId: user.id,
        role,
        status,
        ...(role === 'PROMOTER' && {
          commissionType: 'PERCENTAGE',
          commissionValue: 10,
        }),
      },
    });
  }

  async function myStaff(user: User) {
    const res = await request(t.app.getHttpServer())
      .get('/events/staff/me')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    return res.body as MyStaff;
  }

  it('muestra solo los eventos donde aceptó trabajar, con sus roles y los datos del evento', async () => {
    const worker = await createUser(t.prisma);
    const accepted = await createOrganizerWithEvent(t.prisma);
    await t.prisma.event.update({
      where: { id: accepted.event.id },
      data: { venueName: 'Niceto Club' },
    });
    await t.prisma.user.update({
      where: { id: accepted.organizer.id },
      data: { name: 'Organizadora' },
    });
    const pending = await createOrganizerWithEvent(t.prisma);
    const rejected = await createOrganizerWithEvent(t.prisma);
    const someoneElse = await createOrganizerWithEvent(t.prisma);
    await addStaff(accepted.event.id, worker, 'SCANNER');
    const promoter = await addStaff(accepted.event.id, worker, 'PROMOTER');
    const invitation = await addStaff(
      pending.event.id,
      worker,
      'SCANNER',
      'PENDING',
    );
    await addStaff(rejected.event.id, worker, 'SCANNER', 'REJECTED');
    await addStaff(someoneElse.event.id, await createUser(t.prisma), 'SCANNER');

    const body = await myStaff(worker);

    expect(body.events).toEqual([
      expect.objectContaining({
        id: accepted.event.id,
        organizerName: 'Organizadora',
        venueName: 'Niceto Club',
        phase: 'NOT_STARTED',
        roles: ['PROMOTER', 'SCANNER'],
      }),
    ]);
    expect(body.events[0].promoter).toMatchObject({ staffId: promoter.id });
    expect(body.invitations).toEqual([
      expect.objectContaining({ id: invitation.id, role: 'SCANNER' }),
    ]);
    expect(body.invitations[0].event.id).toBe(pending.event.id);
    const json = JSON.stringify(body);
    expect(json).not.toContain(accepted.organizer.email);
    expect(json).not.toMatch(/passwordHash|mercadoPago/i);
  });

  it('cuenta solo las entradas de sus ventas pagadas, por evento y en total', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    const worker = await createUser(t.prisma);
    const promoter = await addStaff(event.id, worker, 'PROMOTER');
    const buyer = await createUser(t.prisma);
    for (const [quantity, status] of [
      [2, 'PAID'],
      [3, 'PAID'],
      [4, 'PENDING'],
      [5, 'CANCELLED'],
    ] as const) {
      await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity,
        status,
        promoterId: promoter.id,
      });
    }

    const body = await myStaff(worker);

    expect(body.events[0].promoter?.ticketsSold).toBe(5);
    expect(body.promoterTotals?.ticketsSold).toBe(5);
  });

  it('suma lo ganado, lo cobrado y lo que le deben de todos sus eventos al centavo', async () => {
    const worker = await createUser(t.prisma);
    for (const totalPaid of [0.1, 0.2, 0]) {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const promoter = await addStaff(event.id, worker, 'PROMOTER');
      await t.prisma.eventStaff.update({
        where: { id: promoter.id },
        data: { totalEarned: 1500.15, totalPaid },
      });
    }

    const body = await myStaff(worker);

    expect(body.promoterTotals).toEqual({
      totalEarned: 4500.45,
      totalPaid: 0.3,
      owed: 4500.15,
      ticketsSold: 0,
    });
  });

  it('quien solo escanea no tiene totales de RPP', async () => {
    const { event } = await createOrganizerWithEvent(t.prisma);
    const worker = await createUser(t.prisma);
    await addStaff(event.id, worker, 'SCANNER');

    const body = await myStaff(worker);

    expect(body.promoterTotals).toBeNull();
    expect(body.events.map((ev) => ev.roles)).toEqual([['SCANNER']]);
  });

  it('sin sesión responde 401', async () => {
    await request(t.app.getHttpServer()).get('/events/staff/me').expect(401);
  });

  describe('quién puede escanear', () => {
    async function canScan(user: User) {
      const res = await request(t.app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', authHeader(t.app, user))
        .expect(200);
      return (res.body as { isCurrentlyScanner: boolean }).isCurrentlyScanner;
    }

    it.each(['SCANNER', 'MANAGER'] as const)(
      'un %s aceptado en un evento que no terminó puede escanear',
      async (role) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const worker = await createUser(t.prisma);
        await addStaff(event.id, worker, role);

        expect(await canScan(worker)).toBe(true);
      },
    );

    it('un encargado con la invitación pendiente o de un evento terminado no', async () => {
      const pending = await createOrganizerWithEvent(t.prisma);
      const finished = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: finished.event.id },
        data: { status: 'FINISHED' },
      });
      const worker = await createUser(t.prisma);
      await addStaff(pending.event.id, worker, 'MANAGER', 'PENDING');
      await addStaff(finished.event.id, worker, 'MANAGER');

      expect(await canScan(worker)).toBe(false);
    });
  });
});
