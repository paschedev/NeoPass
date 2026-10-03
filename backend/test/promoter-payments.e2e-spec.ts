import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];

type Promoter = {
  id: string;
  name: string;
  ticketsSold: number;
  salesAmount: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payments: { amount: number; note: string | null; createdAt: string }[];
};

describe('Pagos a los RPPs del evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  // Evento con un RPP aceptado que vendió 2 entradas de $1000 (10% = $200).
  async function eventWithPromoter() {
    const created = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    const rppUser = await createUser(t.prisma, { name: 'Rocío RPP' });
    const promoter = await t.prisma.eventStaff.create({
      data: {
        eventId: created.event.id,
        userId: rppUser.id,
        role: 'PROMOTER',
        status: 'ACCEPTED',
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
        totalEarned: 200,
      },
    });
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType: created.ticketType,
      quantity: 2,
      status: 'PAID',
      promoterId: promoter.id,
    });
    await t.prisma.order.update({
      where: { id: order.id },
      data: { promoterCommission: 200 },
    });
    return { ...created, rppUser, promoter };
  }

  function listPromoters(user: User, eventId: string) {
    return request(t.app.getHttpServer())
      .get(`/events/organizer/${eventId}/promoters`)
      .set('Authorization', authHeader(t.app, user));
  }

  function pay(
    user: User,
    eventId: string,
    staffId: string,
    body: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .post(`/events/organizer/${eventId}/promoters/${staffId}/payments`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  async function promoterOf(user: User, eventId: string) {
    const res = await listPromoters(user, eventId).expect(200);
    return (res.body as Promoter[])[0];
  }

  async function savedTotalPaid(staffId: string) {
    const staff = await t.prisma.eventStaff.findUniqueOrThrow({
      where: { id: staffId },
    });
    return Number(staff.totalPaid);
  }

  it('el organizador ve a sus RPPs con lo vendido, la comisión ganada, lo pagado y el saldo', async () => {
    const { organizer, event, promoter } = await eventWithPromoter();
    const scanner = await createUser(t.prisma);
    await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: scanner.id,
        role: 'SCANNER',
        status: 'ACCEPTED',
      },
    });

    const res = await listPromoters(organizer, event.id).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        id: promoter.id,
        name: 'Rocío RPP',
        ticketsSold: 2,
        salesAmount: 2000,
        totalEarned: 200,
        totalPaid: 0,
        balance: 200,
        payments: [],
      }),
    ]);
  });

  it('registrar un pago lo suma a lo pagado, baja el saldo y queda en el historial', async () => {
    const { organizer, event, promoter } = await eventWithPromoter();

    const res = await pay(organizer, event.id, promoter.id, {
      amount: 150,
      note: '  Transferencia ',
    }).expect(201);

    expect(res.body).toMatchObject({ totalPaid: 150, balance: 50 });
    const listed = await promoterOf(organizer, event.id);
    expect(listed).toMatchObject({ totalPaid: 150, balance: 50 });
    expect(listed.payments).toEqual([
      {
        amount: 150,
        note: 'Transferencia',
        createdAt: expect.any(String) as string,
      },
    ]);
  });

  it('se puede pagar en partes hasta saldar la comisión', async () => {
    const { organizer, event, promoter } = await eventWithPromoter();

    await pay(organizer, event.id, promoter.id, { amount: 120.5 }).expect(201);
    await pay(organizer, event.id, promoter.id, { amount: 79.5 }).expect(201);

    const listed = await promoterOf(organizer, event.id);
    expect(listed).toMatchObject({ totalPaid: 200, balance: 0 });
    expect(listed.payments.map(({ amount }) => amount)).toEqual([79.5, 120.5]);
  });

  it('no deja registrar más que lo que se le debe', async () => {
    const { organizer, event, promoter } = await eventWithPromoter();

    const res = await pay(organizer, event.id, promoter.id, {
      amount: 200.01,
    }).expect(409);

    expect((res.body as { message: string }).message).toBe(
      'El pago supera lo que se le debe ($200)',
    );
    expect(await savedTotalPaid(promoter.id)).toBe(0);
  });

  it('dos pagos registrados a la vez no superan lo que se le debe', async () => {
    const { organizer, event, promoter } = await eventWithPromoter();

    const results = await Promise.all([
      pay(organizer, event.id, promoter.id, { amount: 200 }),
      pay(organizer, event.id, promoter.id, { amount: 200 }),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
    expect(await savedTotalPaid(promoter.id)).toBe(200);
    expect(await t.prisma.promoterPayment.count()).toBe(1);
  });

  it.each([
    ['un monto de cero', { amount: 0 }],
    ['un monto negativo', { amount: -10 }],
    ['un monto que no es un número', { amount: 'mucho' }],
    ['un monto con más de dos decimales', { amount: 10.555 }],
    ['sin monto', {}],
    ['una nota demasiado larga', { amount: 10, note: 'a'.repeat(101) }],
  ])('rechaza %s', async (_case, body) => {
    const { organizer, event, promoter } = await eventWithPromoter();

    await pay(organizer, event.id, promoter.id, body).expect(400);

    expect(await savedTotalPaid(promoter.id)).toBe(0);
  });

  describe('permisos', () => {
    it('otro organizador no puede ver ni pagar a los RPPs del evento', async () => {
      const { event, promoter } = await eventWithPromoter();
      const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

      await listPromoters(intruder, event.id).expect(403);
      await pay(intruder, event.id, promoter.id, { amount: 10 }).expect(403);
      expect(await savedTotalPaid(promoter.id)).toBe(0);
    });

    it('no se puede pagar a un RPP de otro evento pasando el propio', async () => {
      const mine = await createOrganizerWithEvent(t.prisma);
      const other = await eventWithPromoter();

      await pay(mine.organizer, mine.event.id, other.promoter.id, {
        amount: 10,
      }).expect(404);
      expect(await savedTotalPaid(other.promoter.id)).toBe(0);
    });

    it('a alguien del staff que no es RPP no se le registran pagos', async () => {
      const { organizer, event } = await eventWithPromoter();
      const scannerUser = await createUser(t.prisma);
      const scanner = await t.prisma.eventStaff.create({
        data: {
          eventId: event.id,
          userId: scannerUser.id,
          role: 'SCANNER',
          status: 'ACCEPTED',
        },
      });

      await pay(organizer, event.id, scanner.id, { amount: 10 }).expect(404);
    });

    it('un comprador no puede ver ni pagar', async () => {
      const { event, promoter } = await eventWithPromoter();
      const buyer = await createUser(t.prisma);

      await listPromoters(buyer, event.id).expect(403);
      await pay(buyer, event.id, promoter.id, { amount: 10 }).expect(403);
    });
  });

  describe('en el panel del RPP', () => {
    it('el RPP ve lo que le pagaron, lo que le deben y cada pago', async () => {
      const { organizer, event, promoter, rppUser } = await eventWithPromoter();
      await pay(organizer, event.id, promoter.id, {
        amount: 150,
        note: 'Efectivo',
      }).expect(201);

      const perEvent = await request(t.app.getHttpServer())
        .get(`/events/promoter/me/${event.id}/stats`)
        .set('Authorization', authHeader(t.app, rppUser))
        .expect(200);
      const overall = await request(t.app.getHttpServer())
        .get('/events/promoter/me')
        .set('Authorization', authHeader(t.app, rppUser))
        .expect(200);

      expect(perEvent.body).toMatchObject({
        totalEarned: 200,
        totalPaid: 150,
        balance: 50,
        payments: [
          {
            amount: 150,
            note: 'Efectivo',
            createdAt: expect.any(String) as string,
          },
        ],
      });
      expect(overall.body).toMatchObject({
        totalPaid: 150,
        pendingBalance: 50,
      });
    });
  });
});
