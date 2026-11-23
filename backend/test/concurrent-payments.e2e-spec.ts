import { Order, Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import request from 'supertest';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

// Un evento al 10 % con entradas de $1000; cada compra lleva 2. Con la
// comisión de 35 días ($41,31) la venta le deja al organizador $70,74 de saldo
// a favor de NeoPass (ver fee-adjustment.e2e-spec.ts).
const FEE_AT_35_DAYS = 41.31;
const AT_35_DAYS = 0.01803;

// Para frenar un trabajo a mitad de camino, otra transacción retiene una fila
// que ese trabajo necesita, hasta que el test la suelta.
describe('Pagos en paralelo del mismo organizador', () => {
  let t: TestApp;
  // Lo que Mercado Pago responde por cada pago, que acá corren a la vez.
  const payments = new Map<string, object>();

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    payments.clear();
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
    mercadoPagoMock.paymentGet.mockImplementation((query) => {
      const { id } = query as { id: string };
      const payment = payments.get(id);
      if (!payment) throw new Error(`Pago ${id} sin respuesta simulada`);
      return Promise.resolve(payment);
    });
  });

  afterAll(() => t.close());

  async function organizerWith({
    balance = 0,
    rate = null as number | null,
  } = {}) {
    const created = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    await t.prisma.event.update({
      where: { id: created.event.id },
      data: { neoPassFeePercentage: 10 },
    });
    await t.prisma.user.update({
      where: { id: created.organizer.id },
      data: { mercadoPagoFeeBalance: balance, mercadoPagoFeeRate: rate },
    });
    return created;
  }

  async function buy(ticketTypeId: string) {
    const buyer = await createUser(t.prisma);
    mockTurnstile(true);
    const res = await request(t.app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId, quantity: 2 }],
      })
      .expect(201);
    return t.prisma.order.findUniqueOrThrow({
      where: { id: (res.body as { orderId: string }).orderId },
    });
  }

  function notify(order: Order, payment: object) {
    const paymentId = `pay-${order.id}`;
    payments.set(paymentId, { external_reference: order.id, ...payment });
    return new PaymentsProcessor(t.app.get(PaymentsService)).process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  // mercadoPagoFee: la comisión que informa Mercado Pago (undefined: ninguna).
  function pay(order: Order, mercadoPagoFee?: number) {
    return notify(order, {
      status: 'approved',
      transaction_amount: order.totalAmount.toNumber(),
      date_approved: '2026-10-28T15:00:00.000-03:00',
      money_release_date: '2026-11-02T15:00:00.000-03:00',
      fee_details:
        mercadoPagoFee === undefined
          ? undefined
          : [
              {
                type: 'mercadopago_fee',
                amount: mercadoPagoFee,
                fee_payer: 'collector',
              },
            ],
    });
  }

  function refund(order: Order) {
    return notify(order, { status: 'refunded' });
  }

  // Abre una transacción aparte que toma `lock` y lo retiene hasta release().
  async function hold(
    lock: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    let acquired!: () => void;
    const locked = new Promise<void>((resolve) => (acquired = resolve));
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    const transaction = t.prisma.$transaction(
      async (tx) => {
        await lock(tx);
        acquired();
        await released;
      },
      { timeout: 20_000 },
    );
    await locked;
    return async () => {
      release();
      await transaction;
    };
  }

  // Espera a que haya `count` consultas esperando una fila de otra transacción.
  async function waitForBlocked(count: number) {
    const deadline = Date.now() + 5_000;
    for (;;) {
      const [{ blocked }] = await t.prisma.$queryRaw<{ blocked: number }[]>`
        SELECT count(*)::int AS blocked FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      if (blocked >= count) return;
      if (Date.now() > deadline) {
        throw new Error(
          `Se esperaban ${count} consultas frenadas: hay ${blocked}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  // Si `work` termina antes de `ms`.
  async function finishesWithin(work: Promise<unknown>, ms: number) {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<false>((resolve) => {
      timer = setTimeout(() => resolve(false), ms);
    });
    try {
      return await Promise.race([work.then(() => true as const), late]);
    } finally {
      clearTimeout(timer);
    }
  }

  // Frena el pago de `order` mientras emite sus entradas (otra transacción
  // retiene la fila de su comprador) y corre `other`. Devuelve si `other`
  // terminó mientras el pago seguía frenado; después lo deja terminar.
  async function finishesWhilePaymentIssuesTickets(
    order: Order,
    mercadoPagoFee: number | undefined,
    other: () => Promise<unknown>,
  ) {
    const release = await hold(
      (tx) =>
        tx.$queryRaw`SELECT id FROM "User" WHERE id = ${order.userId} FOR UPDATE`,
    );
    const payment = pay(order, mercadoPagoFee);
    let otherWork: Promise<unknown> = Promise.resolve();
    let finished = false;
    try {
      await waitForBlocked(1);
      otherWork = other();
      finished = await finishesWithin(otherWork, 2_000);
    } finally {
      await release();
    }
    await Promise.all([payment, otherWork]);
    return finished;
  }

  async function statusOf(order: Order) {
    const { status } = await t.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    return status;
  }

  async function stockOf(ticketTypeId: string) {
    return t.prisma.ticketType.findUniqueOrThrow({
      where: { id: ticketTypeId },
      select: { sold: true, reserved: true },
    });
  }

  async function balanceOf(organizerId: string) {
    const organizer = await t.prisma.user.findUniqueOrThrow({
      where: { id: organizerId },
    });
    return organizer.mercadoPagoFeeBalance.toFixed(2);
  }

  it('dos pagos del mismo organizador a la vez se confirman y el saldo queda bien', async () => {
    const { organizer, ticketType } = await organizerWith();
    const first = await buy(ticketType.id);
    const second = await buy(ticketType.id);

    const finished = await finishesWhilePaymentIssuesTickets(
      first,
      FEE_AT_35_DAYS,
      () => pay(second, FEE_AT_35_DAYS),
    );

    expect(finished).toBe(true);
    expect([await statusOf(first), await statusOf(second)]).toEqual([
      'PAID',
      'PAID',
    ]);
    expect(await t.prisma.ticket.count()).toBe(4);
    expect(await stockOf(ticketType.id)).toEqual({ sold: 4, reserved: 0 });
    // 70,74 de cada venta.
    expect(await balanceOf(organizer.id)).toBe('141.48');
  });

  it('un pago y una compra del mismo organizador a la vez no se traban', async () => {
    // Con saldo, la compra bloquea al organizador para reservar su ajuste.
    const { organizer, ticketType } = await organizerWith({
      balance: 150,
      rate: AT_35_DAYS,
    });
    const paid = await buy(ticketType.id);
    expect(paid.feeAdjustment.toFixed(2)).toBe('150.00');

    let bought: Order | undefined;
    const finished = await finishesWhilePaymentIssuesTickets(
      paid,
      undefined,
      async () => {
        bought = await buy(ticketType.id);
      },
    );

    expect(finished).toBe(true);
    expect(await statusOf(paid)).toBe('PAID');
    // El saldo ya lo cobró la primera venta: no se cobra dos veces.
    expect(bought?.feeAdjustment.toFixed(2)).toBe('0.00');
    expect(await stockOf(ticketType.id)).toEqual({ sold: 2, reserved: 2 });
    expect(await balanceOf(organizer.id)).toBe('0.00');
  });

  it('un pago y una devolución del mismo organizador a la vez no se traban', async () => {
    const { organizer, ticketType } = await organizerWith();
    const refunded = await buy(ticketType.id);
    const paid = await buy(ticketType.id);
    await pay(refunded, FEE_AT_35_DAYS);
    expect(await balanceOf(organizer.id)).toBe('70.74');

    const finished = await finishesWhilePaymentIssuesTickets(
      paid,
      FEE_AT_35_DAYS,
      () => refund(refunded),
    );

    expect(finished).toBe(true);
    expect(await statusOf(paid)).toBe('PAID');
    expect(await statusOf(refunded)).toBe('CANCELLED');
    expect(await stockOf(ticketType.id)).toEqual({ sold: 2, reserved: 0 });
    // La devolución saca los 70,74 de su venta y el pago suma los suyos.
    expect(await balanceOf(organizer.id)).toBe('70.74');
  });

  it('un pago que espera su tanda no se traba con una compra ni con una devolución del mismo organizador', async () => {
    // El pago ya tiene al organizador y espera la tanda; la compra y la
    // devolución esperan al organizador. Bloquear en otro orden los trabaría.
    const { organizer, ticketType } = await organizerWith({
      balance: 500,
      rate: AT_35_DAYS,
    });
    const refunded = await buy(ticketType.id);
    await pay(refunded);
    const paid = await buy(ticketType.id);
    // Cobra como máximo el 10 % de las entradas por venta.
    expect(paid.feeAdjustment.toFixed(2)).toBe('200.00');
    expect(await balanceOf(organizer.id)).toBe('300.00');

    const release = await hold(
      (tx) =>
        tx.$queryRaw`SELECT id FROM "TicketType" WHERE id = ${ticketType.id} FOR NO KEY UPDATE`,
    );
    let work: Promise<unknown>[] = [];
    try {
      const payment = pay(paid);
      await waitForBlocked(1);
      work = [payment, refund(refunded), buy(ticketType.id)];
      await waitForBlocked(3);
    } finally {
      await release();
    }
    await Promise.all(work);

    expect(await statusOf(paid)).toBe('PAID');
    expect(await statusOf(refunded)).toBe('CANCELLED');
    expect(await stockOf(ticketType.id)).toEqual({ sold: 2, reserved: 2 });
    // 300 − 200 que cobra el pago + 200 que devuelve la devolución.
    expect(await balanceOf(organizer.id)).toBe('300.00');
  });
});
