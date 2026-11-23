import { Logger } from '@nestjs/common';
import { Prisma, TicketType, User } from '@prisma/client';
import { Job } from 'bullmq';
import request from 'supertest';
import { OrdersProcessor } from '../src/orders/orders.processor';
import { OrdersService } from '../src/orders/orders.service';
import { OrdersRepository } from '../src/orders/repositories/orders.repository';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const PRICE = 1000;
const MINUTE_MS = 60 * 1000;
// El comprador tiene 10 minutos para pagar; el barrido espera 10 minutos más
// para no pisarse con el vencimiento normal y sus reintentos.
const PAYMENT_WINDOW_MS = 10 * MINUTE_MS;
const SWEEP_MARGIN_MS = 10 * MINUTE_MS;

describe('Vencimiento de órdenes impagas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    t.queues.orders.add.mockReset();
  });

  afterAll(() => t.close());

  const repository = () => t.app.get(OrdersRepository);

  function checkout(buyer: Pick<User, 'id'>, ticketType: TicketType) {
    mockTurnstile(true);
    return request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId: ticketType.id, quantity: 2 }],
      });
  }

  function expire(orderId: string) {
    return new OrdersProcessor(t.app.get(OrdersService)).process({
      name: 'expire-order',
      data: { orderId },
    } as Job);
  }

  function sweep(now: Date) {
    return t.app.get(OrdersService).releaseOverdueOrders(now);
  }

  function pay(orderId: string, amount: number) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: orderId,
      transaction_amount: amount,
    });
    return new PaymentsProcessor(t.app.get(PaymentsService)).process({
      name: 'process-payment',
      data: { paymentId: 'pago-1' },
    } as Job);
  }

  // Lo que responde Prisma cuando no consigue una conexión a tiempo.
  function databaseBusy() {
    return new Prisma.PrismaClientKnownRequestError(
      'Transaction API error: Unable to start a transaction in the given time.',
      { code: 'P2028', clientVersion: Prisma.prismaVersion.client },
    );
  }

  async function state(orderId: string, ticketType: TicketType) {
    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const stock = await t.prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketType.id },
    });
    return {
      status: order.status,
      reserved: stock.reserved,
      sold: stock.sold,
      tickets: await t.prisma.ticket.count({ where: { orderId } }),
      payments: await t.prisma.payment.count({ where: { orderId } }),
    };
  }

  function expiringAt(orderId: string, expiresAt: Date) {
    return t.prisma.order.update({
      where: { id: orderId },
      data: { expiresAt },
    });
  }

  it('una orden cuyo vencimiento falló se libera en el próximo barrido y su entrada vuelve a la venta', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: PRICE,
      stock: 2,
    });
    const [first, second] = await Promise.all([
      createUser(t.prisma),
      createUser(t.prisma),
    ]);
    const order = await createOrder(t.prisma, {
      user: first,
      ticketType,
      quantity: 2,
    });
    jest
      .spyOn(repository(), 'releasePendingOrder')
      .mockRejectedValueOnce(databaseBusy());
    await expect(expire(order.id)).rejects.toThrow();
    await checkout(second, ticketType).expect(409);

    await sweep(
      new Date(order.expiresAt.getTime() + SWEEP_MARGIN_MS + MINUTE_MS),
    );

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'EXPIRED',
      reserved: 0,
      sold: 0,
    });
    await checkout(second, ticketType).expect(201);
  });

  it('el barrido no toca órdenes pagadas ni pendientes vigentes', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: PRICE,
      stock: 10,
    });
    const buyer = await createUser(t.prisma);
    const now = new Date();
    const paid = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });
    await expiringAt(paid.id, new Date(now.getTime() - 60 * MINUTE_MS));
    const current = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 1,
    });
    await expiringAt(current.id, new Date(now.getTime() + 5 * MINUTE_MS));
    // Venció hace poco: todavía le toca al vencimiento normal.
    const recent = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 3,
    });
    await expiringAt(recent.id, new Date(now.getTime() - 5 * MINUTE_MS));

    await sweep(now);

    const statuses = await t.prisma.order.findMany({
      where: { id: { in: [paid.id, current.id, recent.id] } },
      select: { id: true, status: true },
    });
    expect(Object.fromEntries(statuses.map((o) => [o.id, o.status]))).toEqual({
      [paid.id]: 'PAID',
      [current.id]: 'PENDING',
      [recent.id]: 'PENDING',
    });
    expect(
      await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      }),
    ).toMatchObject({ reserved: 4, sold: 2 });
  });

  it('si el pago llega durante el barrido, la orden queda pagada y el stock se mueve una sola vez', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: PRICE,
      stock: 10,
    });
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    // Otra compra en curso del mismo tipo de entrada: su reserva no se toca.
    const other = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 1,
    });
    await expiringAt(other.id, new Date(Date.now() + 60 * MINUTE_MS));
    // El barrido ya leyó la orden como pendiente cuando se acredita el pago.
    const findOverdue =
      repository().findPendingOrdersExpiredBefore.bind(repository());
    jest
      .spyOn(repository(), 'findPendingOrdersExpiredBefore')
      .mockImplementationOnce(async (...args) => {
        const overdue = await findOverdue(...args);
        await pay(order.id, 2 * PRICE);
        return overdue;
      });

    await sweep(
      new Date(order.expiresAt.getTime() + SWEEP_MARGIN_MS + MINUTE_MS),
    );

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PAID',
      reserved: 1,
      sold: 2,
      tickets: 2,
      payments: 1,
    });
  });

  it('el vencimiento se reintenta si la base está ocupada', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: PRICE,
      stock: 10,
    });
    const buyer = await createUser(t.prisma);
    const res = await checkout(buyer, ticketType).expect(201);
    const { orderId } = res.body as { orderId: string };

    // BullMQ solo vuelve a correr un trabajo fallido si se encoló con
    // reintentos.
    expect(t.queues.orders.add).toHaveBeenCalledWith(
      'expire-order',
      { orderId },
      expect.objectContaining({
        delay: PAYMENT_WINDOW_MS,
        attempts: expect.any(Number) as number,
        backoff: expect.anything() as unknown,
      }),
    );
    const [, , options] = t.queues.orders.add.mock.calls[0] as [
      string,
      unknown,
      { attempts: number },
    ];
    expect(options.attempts).toBeGreaterThan(1);

    jest
      .spyOn(repository(), 'releasePendingOrder')
      .mockRejectedValueOnce(databaseBusy());
    await expect(expire(orderId)).rejects.toThrow();
    expect(await state(orderId, ticketType)).toMatchObject({
      status: 'PENDING',
      reserved: 2,
    });

    await expire(orderId);

    expect(await state(orderId, ticketType)).toMatchObject({
      status: 'EXPIRED',
      reserved: 0,
    });
  });
});
