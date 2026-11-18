import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
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

  it('el comprador paga el cargo del evento más su mitad de la comisión de Mercado Pago, redondeado a centavos', async () => {
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
    expect(order.serviceFee.toFixed(2)).toBe('65.93');
    expect(order.marketplaceFee.toFixed(2)).toBe('50.00');
    expect(order.totalAmount.toFixed(2)).toBe('399.26');
    const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
      { body: { items: MpItem[]; marketplace_fee?: number } },
      string,
    ];
    const fee = preference.body.items.find((i) => i.id === 'service_fee');
    expect(fee?.unit_price).toBe(65.93);
    expect(preference.body.marketplace_fee).toBe(50);
  });

  it('una entrada de $10.000 al 10 % le cuesta $11.457 al comprador y NeoPass recibe su cargo completo', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 10000,
    });
    await t.prisma.event.update({
      where: { id: event.id },
      data: { neoPassFeePercentage: 10 },
    });
    const buyer = await createUser(t.prisma);

    const res = await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(201);

    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: (res.body as { orderId: string }).orderId },
    });
    expect(order.serviceFee.toFixed(2)).toBe('1457.00');
    expect(order.marketplaceFee.toFixed(2)).toBe('1000.00');
    expect(order.totalAmount.toFixed(2)).toBe('11457.00');
    const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
      { body: { marketplace_fee?: number } },
      string,
    ];
    expect(preference.body.marketplace_fee).toBe(1000);
  });

  it('un evento al 0 % cobra la mitad de la comisión como cargo por servicio y NeoPass no recibe nada', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 10000,
    });
    await t.prisma.event.update({
      where: { id: event.id },
      data: { neoPassFeePercentage: 0 },
    });
    const buyer = await createUser(t.prisma);

    const res = await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(201);

    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: (res.body as { orderId: string }).orderId },
    });
    expect(order.serviceFee.toFixed(2)).toBe('416.00');
    expect(order.marketplaceFee.toFixed(2)).toBe('0.00');
    expect(order.totalAmount.toFixed(2)).toBe('10416.00');
    const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
      { body: { items: MpItem[]; marketplace_fee?: number } },
      string,
    ];
    expect(
      preference.body.items.find((i) => i.id === 'service_fee')?.unit_price,
    ).toBe(416);
    expect(preference.body.marketplace_fee).toBeUndefined();
  });

  it('la base no deja que NeoPass se quede con más que el cargo ni con un monto negativo, aunque se cambie por SQL', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const order = await createOrder(t.prisma, {
      user: await createUser(t.prisma),
      ticketType,
    });

    for (const fee of [1, -1]) {
      await expect(
        t.prisma
          .$executeRaw`UPDATE "Order" SET "marketplaceFee" = ${fee} WHERE id = ${order.id}`,
      ).rejects.toThrow(/Order_marketplaceFee_range/);
    }
  });

  it('cobra con la cuenta del organizador y le pasa a NeoPass su parte del cargo', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 1000,
    });
    await t.prisma.event.update({
      where: { id: event.id },
      data: { neoPassFeePercentage: 10 },
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
    }).expect(201);

    const [preference, accessToken] = mercadoPagoMock.preferenceCreate.mock
      .calls[0] as [{ body: { marketplace_fee?: number } }, string];
    expect(accessToken).toBe('TEST-organizer-access-token');
    expect(preference.body.marketplace_fee).toBe(200);
  });

  describe('con la comisión real del organizador', () => {
    // A 35 días Mercado Pago cobra 1,49 % + IVA = 1,803 %. Con un cargo del
    // 10 % el comprador paga 11 % y NeoPass se queda con el 10 %.
    async function eventOfOrganizerAt35Days() {
      const created = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      await t.prisma.event.update({
        where: { id: created.event.id },
        data: { neoPassFeePercentage: 10 },
      });
      await t.prisma.user.update({
        where: { id: created.organizer.id },
        data: { mercadoPagoFeeRate: 0.01803, mercadoPagoReleaseDays: 35 },
      });
      return created;
    }

    function publicEvent(eventId: string) {
      return request(t.app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(200)
        .then((res) => res.body as Record<string, unknown>);
    }

    it('un organizador que cobra a 35 días le cobra al comprador una mitad más chica', async () => {
      const { ticketType } = await eventOfOrganizerAt35Days();
      const buyer = await createUser(t.prisma);

      const res = await checkout(buyer, {
        items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      }).expect(201);

      const order = await t.prisma.order.findUniqueOrThrow({
        where: { id: (res.body as { orderId: string }).orderId },
      });
      expect(order.serviceFee.toFixed(2)).toBe('220.00');
      expect(order.marketplaceFee.toFixed(2)).toBe('200.00');
      expect(order.totalAmount.toFixed(2)).toBe('2220.00');
      const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
        { body: { items: MpItem[]; marketplace_fee?: number } },
        string,
      ];
      expect(
        preference.body.items.find((i) => i.id === 'service_fee')?.unit_price,
      ).toBe(220);
      expect(preference.body.marketplace_fee).toBe(200);
    });

    it('la página del evento informa el porcentaje que paga el comprador, sin la tasa del organizador ni el cargo de NeoPass', async () => {
      const { event } = await eventOfOrganizerAt35Days();

      const body = await publicEvent(event.id);

      expect(body.buyerFeePercentage).toBe('11');
      expect(body).not.toHaveProperty('neoPassFeePercentage');
      expect(JSON.stringify(body)).not.toContain('mercadoPagoFeeRate');
    });

    it('sin ventas registradas, la página y el checkout usan la tasa al instante', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { neoPassFeePercentage: 10 },
      });

      const body = await publicEvent(event.id);

      expect(body.buyerFeePercentage).toBe('14.57');
    });
  });

  it('pide a Mercado Pago solo notificaciones firmadas', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(201);

    const [preference] = mercadoPagoMock.preferenceCreate.mock.calls[0] as [
      { body: { notification_url?: string } },
      string,
    ];
    expect(preference.body.notification_url).toBe(
      'https://api.neopass.test/payments/webhook?source_news=webhooks',
    );
  });

  it('si el organizador no vinculó Mercado Pago, no se vende nada', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma);
    await t.prisma.user.update({
      where: { id: organizer.id },
      data: { mercadoPagoAccessToken: null },
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(409);

    expect(await reservedTotal()).toBe(0);
    expect(await t.prisma.order.count()).toBe(0);
    expect(mercadoPagoMock.preferenceCreate).not.toHaveBeenCalled();
  });

  it('si el token de Mercado Pago del organizador venció, no se vende nada', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma);
    await t.prisma.user.update({
      where: { id: organizer.id },
      data: { mercadoPagoTokenExpiresAt: new Date(Date.now() - 60_000) },
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(409);

    expect(await reservedTotal()).toBe(0);
    expect(await t.prisma.order.count()).toBe(0);
    expect(mercadoPagoMock.preferenceCreate).not.toHaveBeenCalled();
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
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    const second = await createBatch(t.prisma, {
      eventId: event.id,
      name: 'General',
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [
        { ticketTypeId: ticketType.id, quantity: 6 },
        { ticketTypeId: second.ticketType.id, quantity: 5 },
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

  it('una entrada que no existe responde 404', async () => {
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [
        { ticketTypeId: '00000000-0000-4000-8000-000000000000', quantity: 1 },
      ],
    }).expect(404);
  });

  it('la misma entrada no se puede repetir en una orden', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [
        { ticketTypeId: ticketType.id, quantity: 1 },
        { ticketTypeId: ticketType.id, quantity: 1 },
      ],
    }).expect(400);

    expect(await reservedTotal()).toBe(0);
  });

  it('si no quedan suficientes entradas responde 409 y no reserva nada', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      stock: 2,
    });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 3 }],
    }).expect(409);

    expect(await reservedTotal()).toBe(0);
    expect(await t.prisma.order.count()).toBe(0);
  });

  it('de dos compras simultáneas de la última entrada, solo una la reserva', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      stock: 1,
    });
    const [first, second] = await Promise.all([
      createUser(t.prisma),
      createUser(t.prisma),
    ]);
    const items = [{ ticketTypeId: ticketType.id, quantity: 1 }];
    mockTurnstile(true); // una respuesta del captcha por compra

    const statuses = (
      await Promise.all([
        checkout(first, { items }),
        checkout(second, { items }),
      ])
    ).map((res) => res.status);

    expect(statuses.sort()).toEqual([201, 409]);
    expect(await reservedTotal()).toBe(1);
  });

  // Toma la fila con FOR UPDATE en otra transacción, como una compra o un
  // pago en curso, y la suelta cuando se resuelve la promesa devuelta.
  async function holdRow(table: 'User' | 'TicketType', id: string) {
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    const holder = t.prisma.$transaction(
      async (tx) => {
        await tx.$queryRawUnsafe(
          `SELECT 1 FROM "${table}" WHERE id = $1 FOR UPDATE`,
          id,
        );
        locked();
        await released;
      },
      { timeout: 20_000 },
    );
    await isLocked;
    return async () => {
      release();
      await holder;
    };
  }

  const delay = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('una compra de un organizador sin saldo no espera a otra compra en curso del mismo organizador', async () => {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);
    const releaseOrganizer = await holdRow('User', organizer.id);

    const purchase = checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).then((res) => res.status);
    const outcome = await Promise.race([
      purchase,
      delay(2_000).then(() => 'sigue esperando'),
    ]);
    await releaseOrganizer();
    await purchase;

    expect(outcome).toBe(201);
  });

  it('si la compra no consigue la base a tiempo, responde 503 para reintentar y no deja reserva ni orden', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);
    // La transacción de la compra vence a los 5 s; la tanda sigue tomada 6 s.
    const releaseTicketType = await holdRow('TicketType', ticketType.id);
    const releaseLater = delay(6_000).then(releaseTicketType);

    const res = await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    });
    await releaseLater;

    expect(res.status).toBe(503);
    expect((res.body as { message: string }).message).toBe(
      'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.',
    );
    expect(await reservedTotal()).toBe(0);
    expect(await t.prisma.order.count()).toBe(0);
  }, 20_000);

  it.each([
    ['cancelado', { status: 'CANCELLED' as const }],
    [
      'que ya terminó',
      {
        startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ],
  ])('no vende entradas de un evento %s: responde 409', async (_case, data) => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    await t.prisma.event.update({ where: { id: event.id }, data });
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(409);

    expect(await reservedTotal()).toBe(0);
  });

  it('si Mercado Pago no responde, avisa con 502 y libera la reserva', async () => {
    mercadoPagoMock.preferenceCreate.mockRejectedValueOnce(
      new Error('Mercado Pago no disponible'),
    );
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);

    await checkout(buyer, {
      items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
    }).expect(502);

    expect(await reservedTotal()).toBe(0);
    const order = await t.prisma.order.findFirstOrThrow();
    expect(order.status).toBe('CANCELLED');
  });
});
