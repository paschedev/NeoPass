import request from 'supertest';
import {
  EventStatus,
  Prisma,
  StaffRole,
  StaffStatus,
  User,
} from '@prisma/client';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type Overview = {
  totals: {
    owed: number;
    paid: number;
    earned: number;
    promotersOwed: number;
    eventsOwed: number;
    activeStaff: number;
    pendingInvitations: number;
  };
  events: {
    id: string;
    title: string;
    phase: string;
    owed: number;
    promoters: {
      id: string;
      name: string;
      ticketsSold: number;
      totalEarned: number;
      totalPaid: number;
      balance: number;
      owedAcrossEvents: { amount: number; events: number };
    }[];
    scanners: { id: string; name: string; status: StaffStatus }[];
    managers: { id: string; name: string; status: StaffStatus }[];
  }[];
};

describe('Staff del organizador agrupado por evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function overview(user: User) {
    return request(t.app.getHttpServer())
      .get('/events/organizer/staff/overview')
      .set('Authorization', authHeader(t.app, user));
  }

  async function getOverview(user: User) {
    const res = await overview(user).expect(200);
    return res.body as Overview;
  }

  // Otro evento del mismo organizador, que dura seis horas desde `startsInDays`.
  function createEvent(
    organizerId: string,
    title: string,
    startsInDays: number,
    status: EventStatus = 'PUBLISHED',
  ) {
    const start = Date.now() + startsInDays * DAY_MS;
    return t.prisma.event.create({
      data: {
        title,
        description: 'Descripción del evento',
        startDate: new Date(start),
        endDate: new Date(start + 6 * HOUR_MS),
        status,
        organizerId,
      },
    });
  }

  async function addStaff(
    eventId: string,
    name: string,
    {
      role = 'PROMOTER',
      status = 'ACCEPTED',
      earned = 0,
      paid = 0,
      user,
    }: {
      role?: StaffRole;
      status?: StaffStatus;
      earned?: Prisma.Decimal.Value;
      paid?: Prisma.Decimal.Value;
      user?: User;
    } = {},
  ) {
    const member = user ?? (await createUser(t.prisma, { name }));
    const staff = await t.prisma.eventStaff.create({
      data: {
        eventId,
        userId: member.id,
        role,
        status,
        ...(role === 'PROMOTER' && {
          commissionType: 'PERCENTAGE',
          commissionValue: 10,
          totalEarned: earned,
          totalPaid: paid,
        }),
      },
    });
    return { user: member, staff };
  }

  it('agrupa el staff por evento con lo que se le debe a cada RPP, a cada evento y en total', async () => {
    const { organizer, event } = await createOrganizerWithEvent(t.prisma);
    const past = await createEvent(organizer.id, 'Fiesta pasada', -10);
    const ana = await addStaff(event.id, 'Ana', {
      earned: '200.10',
      paid: '100',
    });
    await addStaff(event.id, 'Beto', { earned: '0.20' });
    await addStaff(past.id, 'Ana', { earned: '50', user: ana.user });
    await addStaff(event.id, 'Caro', { role: 'SCANNER' });

    const body = await getOverview(organizer);

    expect(body.totals).toMatchObject({
      owed: 150.3,
      paid: 100,
      earned: 250.3,
      promotersOwed: 2,
      eventsOwed: 2,
      activeStaff: 3,
      pendingInvitations: 0,
    });
    expect(body.events.map((group) => [group.id, group.owed])).toEqual([
      [event.id, 100.3],
      [past.id, 50],
    ]);
    expect(body.events[0].promoters).toEqual([
      expect.objectContaining({
        id: ana.staff.id,
        name: 'Ana',
        totalEarned: 200.1,
        totalPaid: 100,
        balance: 100.1,
        owedAcrossEvents: { amount: 150.1, events: 2 },
      }),
      expect.objectContaining({ name: 'Beto', balance: 0.2 }),
    ]);
    expect(body.events[0].scanners).toEqual([
      expect.objectContaining({ name: 'Caro', status: 'ACCEPTED' }),
    ]);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|mercadoPago/i);
  });

  it('las entradas vendidas de cada RPP cuentan solo órdenes pagadas', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    const { staff } = await addStaff(event.id, 'Ana');
    const buyer = await createUser(t.prisma);
    const sale = (
      quantity: number,
      status: 'PAID' | 'PENDING' | 'CANCELLED' | 'EXPIRED',
      promoterId?: string,
    ) =>
      createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity,
        status,
        promoterId,
      });

    await sale(2, 'PAID', staff.id);
    await sale(3, 'PAID', staff.id);
    await sale(1, 'PENDING', staff.id);
    await sale(4, 'CANCELLED', staff.id);
    await sale(5, 'EXPIRED', staff.id);
    await sale(6, 'PAID');

    const body = await getOverview(organizer);

    expect(body.events[0].promoters[0].ticketsSold).toBe(5);
  });

  it('un pago registrado baja la deuda del RPP, la del evento y la total', async () => {
    const { organizer, event } = await createOrganizerWithEvent(t.prisma);
    const ana = await addStaff(event.id, 'Ana', { earned: '300' });
    await addStaff(event.id, 'Beto', { earned: '100' });

    await request(t.app.getHttpServer())
      .post(`/events/organizer/${event.id}/promoters/${ana.staff.id}/payments`)
      .set('Authorization', authHeader(t.app, organizer))
      .send({ amount: 120.5 })
      .expect(201);

    const body = await getOverview(organizer);

    expect(body.events[0].promoters[0]).toMatchObject({
      name: 'Ana',
      totalPaid: 120.5,
      balance: 179.5,
    });
    expect(body.events[0].owed).toBe(279.5);
    expect(body.totals).toMatchObject({ owed: 279.5, paid: 120.5 });
  });

  it('muestra los eventos que no terminaron aunque no tengan staff, y los terminados solo si tuvieron staff', async () => {
    const { organizer, event: upcoming } = await createOrganizerWithEvent(
      t.prisma,
    );
    const pastWithStaff = await createEvent(organizer.id, 'Con staff', -10);
    await addStaff(pastWithStaff.id, 'Ana', { role: 'SCANNER' });
    await createEvent(organizer.id, 'Pasado sin staff', -3);
    await createEvent(organizer.id, 'Cancelado sin staff', 5, 'CANCELLED');

    const body = await getOverview(organizer);

    expect(body.events.map((group) => group.id)).toEqual([
      upcoming.id,
      pastWithStaff.id,
    ]);
    expect(body.events[0]).toMatchObject({
      phase: 'NOT_STARTED',
      owed: 0,
      promoters: [],
      scanners: [],
      managers: [],
    });
  });

  it('no muestra eventos ni staff de otros organizadores', async () => {
    const mine = await createOrganizerWithEvent(t.prisma);
    const other = await createOrganizerWithEvent(t.prisma);
    await addStaff(mine.event.id, 'Ana', { earned: '100' });
    await addStaff(other.event.id, 'Beto', { earned: '900' });

    const body = await getOverview(mine.organizer);

    expect(body.events.map((group) => group.id)).toEqual([mine.event.id]);
    expect(body.events[0].promoters.map((promoter) => promoter.name)).toEqual([
      'Ana',
    ]);
    expect(body.totals).toMatchObject({ owed: 100, earned: 100 });
  });

  it('sin sesión responde 401 y a quien no es organizador 403', async () => {
    const buyer = await createUser(t.prisma);

    await request(t.app.getHttpServer())
      .get('/events/organizer/staff/overview')
      .expect(401);
    await overview(buyer).expect(403);
  });
});
