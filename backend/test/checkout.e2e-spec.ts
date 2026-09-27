import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MpItem = { id: string; unit_price: number; quantity: number };

describe('Checkout', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mockTurnstile(true);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
  });

  afterAll(() => t.close());

  function checkout(
    buyer: Parameters<typeof authHeader>[1],
    body: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({ captchaToken: 'captcha-de-prueba', ...body });
  }

  async function reservedTotal() {
    const types = await t.prisma.ticketType.findMany();
    return types.reduce((sum, type) => sum + type.reserved, 0);
  }

  it('cobra el cargo de servicio del evento redondeado a centavos', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 333.33,
    });
    await t.prisma.event.update({
      where: { id: event.id },
      data: { neoPassFeePercentage: 15 },
    });
    const buyer = await createUser(t.prisma);

    const res = await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(201);

    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: (res.body as { orderId: string }).orderId },
    });
    expect(order.ticketAmount.toFixed(2)).toBe('333.33');
    expect(order.serviceFee.toFixed(2)).toBe('50.00');
    expect(order.totalAmount.toFixed(2)).toBe('383.33');
    const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
      { body: { items: MpItem[] } },
      string,
    ];
    const fee = preference.body.items.find((i) => i.id === 'service_fee');
    expect(fee?.unit_price).toBe(50);
  });

  it('una orden sin entradas se rechaza', async () => {
    const buyer = await createUser(t.prisma);

    await checkout(buyer, { items: [] }).expect(400);
  });

  it('la cantidad tiene que ser un número entero', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1.5 }],
    }).expect(400);

    expect(await reservedTotal()).toBe(0);
  });

  it('una orden no puede tener más de 10 entradas', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [
        { ticketTypeId: ticketType.id, quantity: 6 },
        { ticketTypeId: ticketType.id, quantity: 5 },
      ],
    }).expect(400);

    expect(await reservedTotal()).toBe(0);
  });

  it('el id de la entrada tiene que ser un UUID', async () => {
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: 'no-es-un-uuid', quantity: 1 }],
    }).expect(400);
  });

  it('no se pueden mezclar entradas de dos eventos en una orden', async () => {
    const first = await createOrganizerWithEvent(t.prisma);
    const second = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [
        { ticketTypeId: first.ticketType.id, quantity: 1 },
        { ticketTypeId: second.ticketType.id, quantity: 1 },
      ],
    }).expect(400);

    expect(await reservedTotal()).toBe(0);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it('un promotor aceptado del evento queda asociado a la orden', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    const promoter = await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: (await createUser(t.prisma)).id,
        role: 'PROMOTER',
        status: 'ACCEPTED',
      },
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
      promoterId: promoter.id,
    }).expect(201);

    const order = await t.prisma.order.findFirstOrThrow();
    expect(order.promoterId).toBe(promoter.id);
  });

  it.each([
    ['de otro evento', 'PROMOTER', 'ACCEPTED', true],
    ['que no aceptó la invitación', 'PROMOTER', 'PENDING', false],
    ['que no es promotor', 'SCANNER', 'ACCEPTED', false],
  ] as const)(
    'un promotor %s no se acredita en la orden',
    async (_case, role, status, otherEvent) => {
      const mine = await createOrganizerWithEvent(t.prisma);
      const other = await createOrganizerWithEvent(t.prisma);
      const staff = await t.prisma.eventStaff.create({
        data: {
          eventId: otherEvent ? other.event.id : mine.event.id,
          userId: (await createUser(t.prisma)).id,
          role,
          status,
        },
      });
      const buyer = await createUser(t.prisma);

      await checkout(buyer, {
        items: [{ ticketTypeId: mine.ticketType.id, quantity: 1 }],
        promoterId: staff.id,
      }).expect(201);

      const order = await t.prisma.order.findFirstOrThrow();
      expect(order.promoterId).toBeNull();
    },
  );
});
