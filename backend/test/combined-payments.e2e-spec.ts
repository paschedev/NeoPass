import { Job } from 'bullmq';
import { TicketType } from '@prisma/client';
import { OrdersProcessor } from '../src/orders/orders.processor';
import { OrdersService } from '../src/orders/orders.service';
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
// Una orden de 2 entradas: el comprador paga 1200 con dinero en cuenta y el
// resto con tarjeta. Mercado Pago lo informa como dos pagos aprobados.
const TOTAL = 2 * PRICE;
const ACCOUNT_MONEY = 1200;
const CARD = TOTAL - ACCOUNT_MONEY;

describe('Pagos combinados (dinero en cuenta y tarjeta)', () => {
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
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    return { organizer, ticketType, buyer, order };
  }

  function processor() {
    return new PaymentsProcessor(t.app.get(PaymentsService));
  }

  function pay(
    paymentId: string,
    orderId: string,
    amount: number,
    extra: Record<string, unknown> = {},
  ) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: orderId,
      transaction_amount: amount,
      ...extra,
    });
    return processor().process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  // El chequeo que la primera parte deja programado para una hora después.
  function checkParts(orderId: string) {
    return processor().process({
      name: 'check-payment-parts',
      data: { orderId },
    } as Job);
  }

  function expire(orderId: string) {
    const orders = new OrdersProcessor(t.app.get(OrdersService));
    return orders.process({
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
      orderBy: { createdAt: 'asc' },
    });
    return notifications.map(
      (n) => (n.metadata as { reason: string } | null)?.reason,
    );
  }

  type MailCall = [string, unknown, { jobId?: string } | undefined];

  function ticketMails() {
    return (t.queues.mail.add.mock.calls as MailCall[]).filter(
      ([name]) => name === 'send-tickets',
    );
  }

  const PAID = {
    status: 'PAID',
    reserved: 0,
    sold: 2,
    tickets: 2,
    payments: 1,
  };

  it('dos partes que suman el total pagan la orden con un solo pago por el total', async () => {
    const { organizer, ticketType, order } = await setup();

    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'PENDING',
      reserved: 2,
      sold: 0,
      tickets: 0,
      payments: 0,
    });

    await pay('pago-tarjeta', order.id, CARD);

    expect(await state(order.id, ticketType)).toEqual(PAID);
    const payment = await t.prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment).toMatchObject({
      status: 'APPROVED',
      providerPaymentId: null,
    });
    expect(payment.amount.toNumber()).toBe(TOTAL);
    expect(ticketMails()).toHaveLength(1);
    expect(await issues(organizer.id)).toEqual([]);
  });

  it('la primera parte programa el chequeo de la hora, una sola vez por orden', async () => {
    const { order } = await setup();

    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);

    expect(t.queues.payments.add).toHaveBeenCalledWith(
      'check-payment-parts',
      { orderId: order.id },
      expect.objectContaining({
        delay: 60 * 60 * 1000,
        jobId: `payment-parts-${order.id}`,
      }),
    );
  });

  it('las partes pueden llegar en cualquier orden y repetidas: no hay aviso de pago duplicado', async () => {
    const { organizer, ticketType, order } = await setup();

    await pay('pago-tarjeta', order.id, CARD);
    await pay('pago-tarjeta', order.id, CARD);
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-tarjeta', order.id, CARD);

    expect(await state(order.id, ticketType)).toEqual(PAID);
    expect(await issues(organizer.id)).toEqual([]);
    const jobIds = ticketMails().map(([, , options]) => options?.jobId);
    expect(new Set(jobIds)).toEqual(new Set([`tickets-${order.id}`]));
  });

  it('dos partes que llegan a la vez pagan la orden una sola vez', async () => {
    const { organizer, ticketType, order } = await setup();

    await Promise.all([
      pay('pago-cuenta', order.id, ACCOUNT_MONEY),
      pay('pago-tarjeta', order.id, CARD),
    ]);

    expect(await state(order.id, ticketType)).toEqual(PAID);
    expect(await issues(organizer.id)).toEqual([]);
  });

  it('una parte sola espera, y a la hora se avisa al organizador que el pago quedó incompleto', async () => {
    const { organizer, ticketType, order } = await setup();

    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    expect(await issues(organizer.id)).toEqual([]);

    await checkParts(order.id);
    await checkParts(order.id);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PENDING',
      tickets: 0,
      payments: 0,
    });
    expect(await issues(organizer.id)).toEqual(['INCOMPLETE_PAYMENT']);
    const notice = await t.prisma.notification.findFirstOrThrow({
      where: { userId: organizer.id, type: 'SYSTEM' },
    });
    expect(notice.title).toBe('Pago incompleto');
    expect(notice.message).toContain('pago-cuenta');
    expect(notice.actionUrl).toBe(`/panel/eventos/${ticketType.eventId}`);
  });

  it('el chequeo de la hora no avisa nada si el pago ya se completó', async () => {
    const { organizer, order } = await setup();
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-tarjeta', order.id, CARD);

    await checkParts(order.id);

    expect(await issues(organizer.id)).toEqual([]);
  });

  it('partes que suman más que el total no pagan la orden y se avisa', async () => {
    const { organizer, ticketType, order } = await setup();

    await pay('pago-1', order.id, 1500);
    await pay('pago-2', order.id, 1500);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PENDING',
      tickets: 0,
      payments: 0,
    });
    expect(await issues(organizer.id)).toEqual(['AMOUNT_MISMATCH']);
  });

  it('una parte de otro pago sobre una orden ya pagada se avisa como duplicado', async () => {
    const { organizer, ticketType, order } = await setup();
    await pay('pago-1', order.id, TOTAL);

    await pay('pago-2', order.id, ACCOUNT_MONEY);

    expect(await state(order.id, ticketType)).toEqual(PAID);
    expect(await issues(organizer.id)).toEqual(['DUPLICATE_PAYMENT']);
  });

  it('un pago combinado de una orden vencida la paga si queda lugar', async () => {
    const { ticketType, order } = await setup();
    await expire(order.id);

    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-tarjeta', order.id, CARD);

    expect(await state(order.id, ticketType)).toEqual(PAID);
  });

  it('un pago combinado tardío sin lugar no vende de más y se avisa', async () => {
    const { organizer, ticketType, buyer, order } = await setup(2);
    await expire(order.id);
    await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
      status: 'PAID',
    });

    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-tarjeta', order.id, CARD);

    expect(await state(order.id, ticketType)).toEqual({
      status: 'EXPIRED',
      reserved: 0,
      sold: 2,
      tickets: 0,
      payments: 0,
    });
    expect(await issues(organizer.id)).toEqual(['OUT_OF_STOCK']);
  });

  it('la devolución de una parte de una orden pagada la anula y devuelve el lugar', async () => {
    const { ticketType, order } = await setup();
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-tarjeta', order.id, CARD);

    await pay('pago-tarjeta', order.id, CARD, { status: 'charged_back' });

    expect(await state(order.id, ticketType)).toEqual({
      status: 'CANCELLED',
      reserved: 0,
      sold: 0,
      tickets: 2,
      payments: 1,
    });
    const tickets = await t.prisma.ticket.findMany({
      where: { orderId: order.id },
    });
    expect(tickets.map((ticket) => ticket.status)).toEqual([
      'REFUNDED',
      'REFUNDED',
    ]);
    const payment = await t.prisma.payment.findUniqueOrThrow({
      where: { orderId: order.id },
    });
    expect(payment.status).toBe('REFUNDED');
  });

  it('una parte devuelta antes de completar el total deja de contar', async () => {
    const { organizer, ticketType, order } = await setup();
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY);
    await pay('pago-cuenta', order.id, ACCOUNT_MONEY, { status: 'refunded' });

    await pay('pago-tarjeta', order.id, CARD);

    expect(await state(order.id, ticketType)).toMatchObject({
      status: 'PENDING',
      tickets: 0,
      payments: 0,
    });

    await checkParts(order.id);

    expect(await issues(organizer.id)).toEqual(['INCOMPLETE_PAYMENT']);
  });

  it('un pago con cuotas con interés se compara sin el interés y paga la orden', async () => {
    const { organizer, ticketType, order } = await setup();

    await pay('pago-cuotas', order.id, TOTAL, {
      transaction_details: { total_paid_amount: 2394.18 },
    });

    expect(await state(order.id, ticketType)).toEqual(PAID);
    expect(await issues(organizer.id)).toEqual([]);
  });

  it('el mismo problema notificado varias veces deja un solo aviso', async () => {
    const { organizer, order } = await setup();

    await pay('pago-1', order.id, TOTAL + 1);
    await pay('pago-1', order.id, TOTAL + 1);

    expect(await issues(organizer.id)).toEqual(['AMOUNT_MISMATCH']);
  });
});
