import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('Editar un evento guarda sus tandas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function putEvent(
    user: Parameters<typeof authHeader>[1],
    eventId: string,
    body: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .put(`/events/${eventId}`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  async function setup() {
    const { organizer, event, batch, ticketType } =
      await createOrganizerWithEvent(t.prisma, { price: 1000, stock: 100 });
    const withStock = (stock: number) => ({
      batches: [
        {
          id: batch.id,
          name: 'Preventa',
          status: 'PUBLISHED',
          ticketTypes: [
            { id: ticketType.id, name: 'General', price: 1000, stock },
          ],
        },
      ],
    });
    return { organizer, event, batch, ticketType, withStock };
  }

  it('guarda el nuevo precio y stock de una entrada', async () => {
    const { organizer, event, batch, ticketType } = await setup();

    await putEvent(organizer, event.id, {
      batches: [
        {
          id: batch.id,
          name: 'Preventa',
          status: 'PUBLISHED',
          ticketTypes: [
            { id: ticketType.id, name: 'General', price: 2500, stock: 80 },
          ],
        },
      ],
    }).expect(200);

    const saved = await t.prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketType.id },
    });
    expect(Number(saved.price)).toBe(2500);
    expect(saved.stock).toBe(80);
  });

  it('acepta las tandas tal como las devuelve la pantalla de edición', async () => {
    const { organizer, event, ticketType } = await setup();
    const loaded = await request(t.app.getHttpServer())
      .get(`/events/organizer/${event.id}`)
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);
    const batches = (
      loaded.body as {
        ticketBatches: { ticketTypes: { price: unknown }[] }[];
      }
    ).ticketBatches;
    // Prisma serializes Decimal prices as strings.
    batches[0].ticketTypes[0].price = '1500.50';

    await putEvent(organizer, event.id, { batches }).expect(200);

    const saved = await t.prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketType.id },
    });
    expect(Number(saved.price)).toBe(1500.5);
  });

  it('agrega una tanda nueva y borra una que no tiene órdenes', async () => {
    const { organizer, event, batch, ticketType } = await setup();
    const unused = await t.prisma.ticketBatch.create({
      data: { eventId: event.id, name: 'Tanda vieja', status: 'DRAFT' },
    });

    await putEvent(organizer, event.id, {
      batches: [
        {
          id: batch.id,
          name: 'Preventa',
          status: 'PUBLISHED',
          ticketTypes: [
            { id: ticketType.id, name: 'General', price: 1000, stock: 100 },
          ],
        },
        {
          name: 'Tanda 2',
          status: 'DRAFT',
          ticketTypes: [{ name: 'VIP', price: 5000, stock: 20 }],
        },
      ],
    }).expect(200);

    const batches = await t.prisma.ticketBatch.findMany({
      where: { eventId: event.id },
      include: { ticketTypes: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(batches.map((b) => b.name)).toEqual(['Preventa', 'Tanda 2']);
    expect(batches[1].ticketTypes[0].name).toBe('VIP');
    expect(
      await t.prisma.ticketBatch.findUnique({ where: { id: unused.id } }),
    ).toBeNull();
  });

  it('no deja bajar el stock por debajo de las entradas vendidas y reservadas, y no guarda nada', async () => {
    const { organizer, event, ticketType, withStock } = await setup();
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 3,
      status: 'PAID',
    });
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PENDING',
    });

    await putEvent(organizer, event.id, {
      title: 'Título nuevo',
      ...withStock(4),
    }).expect(409);

    const saved = await t.prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketType.id },
    });
    expect(saved.stock).toBe(100);
    expect(
      (await t.prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .title,
    ).toBe('Evento de prueba');
  });

  it('permite dejar el stock justo en las entradas vendidas y reservadas', async () => {
    const { organizer, event, ticketType, withStock } = await setup();
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 3,
      status: 'PAID',
    });

    await putEvent(organizer, event.id, withStock(3)).expect(200);
  });

  it('no deja borrar una entrada que tiene órdenes, aunque estén vencidas', async () => {
    const { organizer, event, batch, ticketType } = await setup();
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      status: 'EXPIRED',
    });

    await putEvent(organizer, event.id, {
      title: 'Título nuevo',
      batches: [
        {
          id: batch.id,
          name: 'Preventa',
          status: 'PUBLISHED',
          ticketTypes: [],
        },
      ],
    }).expect(409);

    expect(
      await t.prisma.ticketType.findUnique({ where: { id: ticketType.id } }),
    ).not.toBeNull();
    expect(
      (await t.prisma.event.findUniqueOrThrow({ where: { id: event.id } }))
        .title,
    ).toBe('Evento de prueba');
  });

  it('no deja borrar una tanda con entradas que tienen órdenes', async () => {
    const { organizer, event, batch, ticketType } = await setup();
    const buyer = await createUser(t.prisma);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      status: 'EXPIRED',
    });

    await putEvent(organizer, event.id, { batches: [] }).expect(409);

    expect(
      await t.prisma.ticketBatch.findUnique({ where: { id: batch.id } }),
    ).not.toBeNull();
  });

  it('rechaza un stock con decimales', async () => {
    const { organizer, event, withStock } = await setup();

    await putEvent(organizer, event.id, withStock(10.5)).expect(400);
  });
});
