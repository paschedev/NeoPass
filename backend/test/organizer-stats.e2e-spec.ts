import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type OrganizerStats = { totalRevenue: number; totalTicketsSold: number };

describe('Estadísticas del organizador', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function stats(organizer: Parameters<typeof authHeader>[1]) {
    const res = await request(t.app.getHttpServer())
      .get('/events/organizer/stats')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);
    return res.body as OrganizerStats;
  }

  it('la recaudación total suma lo cobrado al centavo', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
      { price: 1500.15 },
    );
    const others = await Promise.all(
      ['General', 'VIP'].map((name) =>
        createBatch(t.prisma, { eventId: event.id, name, price: 1500.15 }),
      ),
    );
    const buyer = await createUser(t.prisma);
    for (const type of [ticketType, ...others.map((o) => o.ticketType)]) {
      await createOrder(t.prisma, {
        user: buyer,
        ticketType: type,
        status: 'PAID',
      });
    }

    const { totalRevenue, totalTicketsSold } = await stats(organizer);

    expect(totalRevenue).toBe(4500.45);
    expect(totalTicketsSold).toBe(3);
  });

  it('si el precio de la tanda cambia después de vender, lo recaudado no cambia', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 1000,
    });
    await createOrder(t.prisma, {
      user: await createUser(t.prisma),
      ticketType,
      status: 'PAID',
    });
    await t.prisma.ticketType.update({
      where: { id: ticketType.id },
      data: { price: 2000 },
    });

    expect((await stats(organizer)).totalRevenue).toBe(1000);
  });

  it('las órdenes pendientes y las devueltas no suman a lo recaudado', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 1000,
    });
    const buyer = await createUser(t.prisma);
    for (const status of ['PAID', 'PENDING', 'CANCELLED'] as const) {
      await createOrder(t.prisma, { user: buyer, ticketType, status });
    }

    expect((await stats(organizer)).totalRevenue).toBe(1000);
  });

  it('no suma las ventas de eventos de otros organizadores', async () => {
    const mine = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    const other = await createOrganizerWithEvent(t.prisma, { price: 700 });
    const buyer = await createUser(t.prisma);
    for (const { ticketType } of [mine, other]) {
      await createOrder(t.prisma, { user: buyer, ticketType, status: 'PAID' });
    }

    expect((await stats(mine.organizer)).totalRevenue).toBe(1000);
  });
});
