import { Job } from 'bullmq';
import { TicketType } from '@prisma/client';
import { OrdersProcessor } from '../src/orders/orders.processor';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const PRICE = 1000;

describe('Estados de la orden al pagar y al vencer', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function setup(stock = 10) {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: PRICE,
      stock,
    });
    const buyer = await createUser(t.prisma);
    return { organizer, ticketType, buyer };
  }

  function pay(
    paymentId: string,
    orderId: string,
    amount: number,
    status = 'approved',
  ) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status,
      external_reference: orderId,
      transaction_amount: amount,
    });
    const processor = new PaymentsProcessor(t.app.get(PaymentsService));
    return processor.process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  function expire(orderId: string) {
    const processor = new OrdersProcessor(t.prisma);
    return processor.process({
      name: 'expire-order',
      data: { orderId },
    } as Job);
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

  async function issues(organizerId: string) {
    const notifications = await t.prisma.notification.findMany({
      where: { userId: organizerId, type: 'SYSTEM' },
    });
    return notifications.map(
      (n) => (n.metadata as { reason: string } | null)?.reason,
    );
  }

  it('un pago aprobado de una orden pendiente pasa la reserva a vendida y genera los tickets', async () => {
    const { ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await pay('pago-1', order.id, 2 * PRICE);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PAID',
      reserved: 0,
      sold: 2,
      tickets: 2,
      payments: 1,
    });
  });

  it('el mismo pago notificado dos veces se procesa una sola vez', async () => {
    const { organizer, ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await pay('pago-1', order.id, 2 * PRICE);
    await pay('pago-1', order.id, 2 * PRICE);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PAID',
      sold: 2,
      tickets: 2,
      payments: 1,
    });
    expect(await issues(organizer.id)).toEqual([]);
  });

  it('un pago por otro monto no paga la orden y avisa al organizador', async () => {
    const { organizer, ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await pay('pago-1', order.id, 1);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PENDING',
      reserved: 2,
      sold: 0,
      tickets: 0,
      payments: 0,
    });
    expect(await issues(organizer.id)).toEqual(['AMOUNT_MISMATCH']);
  });

  it('un pago tardío de una orden vencida con stock la paga y solo suma vendidas', async () => {
    const { ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    await expire(order.id);

    await pay('pago-1', order.id, 2 * PRICE);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PAID',
      reserved: 0,
      sold: 2,
      tickets: 2,
      payments: 1,
    });
  });

  it('un pago tardío sin stock no vende de más: la orden queda vencida y se avisa', async () => {
    const { organizer, ticketType, buyer } = await setup(2);
    const late = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    await expire(late.id);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });

    await pay('pago-tardio', late.id, 2 * PRICE);

    expect(await state(late.id, ticketType)).toEqual({
      status: 'EXPIRED',
      reserved: 0,
      sold: 2,
      tickets: 0,
      payments: 0,
    });
    expect(await issues(organizer.id)).toEqual(['OUT_OF_STOCK']);
  });

  it('un segundo pago de una orden ya pagada no se pierde: se avisa al organizador', async () => {
    const { organizer, ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    await pay('pago-1', order.id, 2 * PRICE);

    await pay('pago-2', order.id, 2 * PRICE);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PAID',
      sold: 2,
      tickets: 2,
      payments: 1,
    });
    expect(await issues(organizer.id)).toEqual(['DUPLICATE_PAYMENT']);
  });

  it('vencer una orden ya pagada no libera stock', async () => {
    const { ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    await pay('pago-1', order.id, 2 * PRICE);

    await expire(order.id);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PAID',
      reserved: 0,
      sold: 2,
    });
  });

  it('si el vencimiento y el pago llegan a la vez, el stock queda consistente', async () => {
    const { ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await Promise.all([expire(order.id), pay('pago-1', order.id, 2 * PRICE)]);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PAID',
      reserved: 0,
      sold: 2,
      tickets: 2,
      payments: 1,
    });
  });

  it('dos vencimientos a la vez liberan la reserva una sola vez', async () => {
    const { ticketType, buyer } = await setup();
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await Promise.all([expire(order.id), expire(order.id), expire(order.id)]);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'EXPIRED',
      reserved: 0,
      sold: 0,
    });
  });
});
