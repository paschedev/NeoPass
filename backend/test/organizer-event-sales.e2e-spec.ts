import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];

type TicketTypeSales = {
  name: string;
  price: number;
  stock: number;
  sold: number;
  reserved: number;
  available: number;
  revenue: number;
};
type EventSales = {
  event: { id: string; title: string };
  totals: {
    revenue: number;
    sold: number;
    reserved: number;
    capacity: number;
    checkedIn: number;
    refundedOrders: number;
  };
  batches: {
    name: string;
    saleStatus: string;
    ticketTypes: TicketTypeSales[];
  }[];
};

describe('Detalle de ventas del evento para el organizador', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function getSales(user: User, eventId: string) {
    return request(t.app.getHttpServer())
      .get(`/events/organizer/${eventId}/sales`)
      .set('Authorization', authHeader(t.app, user));
  }

  async function sales(user: User, eventId: string) {
    const res = await getSales(user, eventId).expect(200);
    return res.body as EventSales;
  }

  it('muestra el resumen y las ventas de cada tanda y tipo de entrada', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
      { price: 1000, stock: 100 },
    );
    const general = await createBatch(t.prisma, {
      eventId: event.id,
      name: 'General',
      price: 2000,
      stock: 50,
    });
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });
    await createOrder(t.prisma, { user: buyer, ticketType, quantity: 1 });
    await createOrder(t.prisma, {
      user: buyer,
      ticketType: general.ticketType,
      quantity: 1,
      status: 'PAID',
    });

    const body = await sales(organizer, event.id);

    expect(body.event).toMatchObject({ id: event.id, title: event.title });
    expect(body.totals).toEqual({
      revenue: 4000,
      sold: 3,
      reserved: 1,
      capacity: 150,
      checkedIn: 0,
      refundedOrders: 0,
    });
    expect(
      body.batches.map(({ name, saleStatus, ticketTypes }) => ({
        name,
        saleStatus,
        ticketTypes,
      })),
    ).toEqual([
      {
        name: 'Preventa',
        saleStatus: 'ON_SALE',
        ticketTypes: [
          {
            id: ticketType.id,
            name: 'General',
            price: 1000,
            stock: 100,
            sold: 2,
            reserved: 1,
            available: 97,
            revenue: 2000,
          },
        ],
      },
      {
        name: 'General',
        saleStatus: 'ON_SALE',
        ticketTypes: [
          {
            id: general.ticketType.id,
            name: 'General',
            price: 2000,
            stock: 50,
            sold: 1,
            reserved: 0,
            available: 49,
            revenue: 2000,
          },
        ],
      },
    ]);
  });

  it('lo recaudado es lo que se cobró: cambiar el precio después no lo modifica', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
      { price: 1000 },
    );
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });
    await t.prisma.ticketType.update({
      where: { id: ticketType.id },
      data: { price: 5000 },
    });

    const body = await sales(organizer, event.id);

    expect(body.totals.revenue).toBe(2000);
    expect(body.batches[0].ticketTypes[0]).toMatchObject({
      price: 5000,
      revenue: 2000,
    });
  });

  it('una compra devuelta no suma a lo recaudado y se cuenta como devolución', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
      { price: 1000 },
    );
    const buyer = await createUser(t.prisma);
    const refunded = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'CANCELLED',
    });
    await t.prisma.payment.create({
      data: { orderId: refunded.id, amount: 2000, status: 'REFUNDED' },
    });
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 1,
      status: 'EXPIRED',
    });

    const body = await sales(organizer, event.id);

    expect(body.totals).toMatchObject({
      revenue: 0,
      sold: 0,
      refundedOrders: 1,
    });
  });

  it('cuenta las entradas que ya ingresaron', async () => {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });
    const used = await createTicket(t.prisma, { order, ticketType });
    await createTicket(t.prisma, { order, ticketType });
    await t.prisma.ticket.update({
      where: { id: used.id },
      data: { status: 'USED', usedAt: new Date() },
    });

    expect((await sales(organizer, event.id)).totals.checkedIn).toBe(1);
  });

  it('no mezcla las ventas de otros eventos', async () => {
    const mine = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    const other = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType: other.ticketType,
      quantity: 3,
      status: 'PAID',
    });

    const body = await sales(mine.organizer, mine.event.id);

    expect(body.totals).toMatchObject({ revenue: 0, sold: 0 });
  });

  describe('permisos', () => {
    it('otro organizador no puede ver el detalle', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

      await getSales(intruder, event.id).expect(403);
    });

    it('un comprador no puede ver el detalle', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      await getSales(buyer, event.id).expect(403);
    });

    it('un evento que no existe responde que no lo encontró', async () => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      await getSales(organizer, '3f0e5c1e-8f0a-4a52-9c59-2f6d5b1f0a11').expect(
        404,
      );
    });
  });

  describe('en Mis eventos', () => {
    it('lo recaudado de cada evento es lo cobrado, aunque después cambie el precio', async () => {
      const { organizer, event, ticketType } = await createOrganizerWithEvent(
        t.prisma,
        { price: 1000 },
      );
      const buyer = await createUser(t.prisma);
      await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity: 2,
        status: 'PAID',
      });
      await createOrder(t.prisma, { user: buyer, ticketType, quantity: 1 });
      await t.prisma.ticketType.update({
        where: { id: ticketType.id },
        data: { price: 5000 },
      });

      const res = await request(t.app.getHttpServer())
        .get('/events/organizer/me')
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);

      const events = res.body as { id: string; revenue: number }[];
      expect(events.find(({ id }) => id === event.id)?.revenue).toBe(2000);
    });
  });
});
