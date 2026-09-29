import { Logger } from '@nestjs/common';
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

  // Notificación de MP: el pago se lee con el estado que tiene ahora.
  function notify(paymentId: string, payment: Record<string, unknown>) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce(payment);
    const processor = new PaymentsProcessor(t.app.get(PaymentsService));
    return processor.process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  function pay(
    paymentId: string,
    orderId: string,
    amount: number,
    status = 'approved',
  ) {
    return notify(paymentId, {
      status,
      external_reference: orderId,
      transaction_amount: amount,
    });
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

  describe('pagos no aprobados y devoluciones', () => {
    async function paidOrder() {
      const context = await setup();
      const order = await createOrder(t.prisma, {
        user: context.buyer,
        ticketType: context.ticketType,
        quantity: 2,
      });
      await pay('pago-1', order.id, 2 * PRICE);
      return { ...context, order };
    }

    async function ticketStatuses(orderId: string) {
      const tickets = await t.prisma.ticket.findMany({ where: { orderId } });
      return tickets.map((ticket) => ticket.status);
    }

    async function paymentStatus(orderId: string) {
      const payment = await t.prisma.payment.findUniqueOrThrow({
        where: { orderId },
      });
      return payment.status;
    }

    it.each(['refunded', 'charged_back', 'cancelled'])(
      'un pago aprobado que pasa a %s anula la orden y las entradas, y el lugar vuelve a la venta',
      async (status) => {
        const { order, ticketType } = await paidOrder();

        await pay('pago-1', order.id, 2 * PRICE, status);

        expect(await state(order.id, ticketType)).toEqual({
          status: 'CANCELLED',
          reserved: 0,
          sold: 0,
          tickets: 2,
          payments: 1,
        });
        expect(await ticketStatuses(order.id)).toEqual([
          'REFUNDED',
          'REFUNDED',
        ]);
        expect(await paymentStatus(order.id)).toBe('REFUNDED');
      },
    );

    it('una entrada ya usada también queda anulada por la devolución', async () => {
      const { order } = await paidOrder();
      const [used] = await t.prisma.ticket.findMany({
        where: { orderId: order.id },
      });
      await t.prisma.ticket.update({
        where: { id: used.id },
        data: { status: 'USED' },
      });

      await pay('pago-1', order.id, 2 * PRICE, 'refunded');

      expect(await ticketStatuses(order.id)).toEqual(['REFUNDED', 'REFUNDED']);
    });

    it('la misma devolución notificada varias veces libera el lugar una sola vez', async () => {
      const { order, ticketType } = await paidOrder();

      await Promise.all([
        pay('pago-1', order.id, 2 * PRICE, 'refunded'),
        pay('pago-1', order.id, 2 * PRICE, 'refunded'),
      ]);
      await pay('pago-1', order.id, 2 * PRICE, 'refunded');

      expect(await state(order.id, ticketType)).toMatchObject({
        status: 'CANCELLED',
        reserved: 0,
        sold: 0,
      });
    });

    it('la devolución de un pago que nunca se registró no toca la orden', async () => {
      const { ticketType, buyer } = await setup();
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity: 2,
      });

      await pay('pago-x', order.id, 2 * PRICE, 'refunded');

      expect(await state(order.id, ticketType)).toEqual({
        status: 'PENDING',
        reserved: 2,
        sold: 0,
        tickets: 0,
        payments: 0,
      });
    });

    it('un pago nuevo sobre una orden anulada por devolución no la revive y se avisa al organizador', async () => {
      const { organizer, order, ticketType } = await paidOrder();
      await pay('pago-1', order.id, 2 * PRICE, 'refunded');

      await pay('pago-2', order.id, 2 * PRICE);

      expect(await state(order.id, ticketType)).toMatchObject({
        status: 'CANCELLED',
        sold: 0,
        payments: 1,
      });
      expect(await ticketStatuses(order.id)).toEqual(['REFUNDED', 'REFUNDED']);
      expect(await issues(organizer.id)).toEqual(['DUPLICATE_PAYMENT']);
    });

    it('un pago rechazado deja registro con su estado y el motivo, y la orden sigue pendiente', async () => {
      const { ticketType, buyer } = await setup();
      const order = await createOrder(t.prisma, {
        user: buyer,
        ticketType,
        quantity: 2,
      });
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);

      try {
        await notify('pago-1', {
          status: 'rejected',
          status_detail: 'cc_rejected_insufficient_amount',
          external_reference: order.id,
          transaction_amount: 2 * PRICE,
        });

        expect(warn).toHaveBeenCalledWith(
          expect.stringMatching(
            /pago-1.*rejected.*cc_rejected_insufficient_amount/,
          ),
        );
      } finally {
        warn.mockRestore();
      }
      expect(await state(order.id, ticketType)).toMatchObject({
        status: 'PENDING',
        reserved: 2,
      });
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
