import { Job } from 'bullmq';
import request from 'supertest';
import { OrdersProcessor } from '../src/orders/orders.processor';
import { OrdersService } from '../src/orders/orders.service';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

// Un evento al 10 % con entradas de $1000; cada compra lleva 2 (= $2000).
// A 35 días Mercado Pago cobra 1,803 %; al instante, 7,986 %.
const AT_35_DAYS = 0.01803;

describe('Saldo de ajuste por la comisión real de Mercado Pago', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
  });

  afterAll(() => t.close());

  async function organizerWith({
    balance = 0,
    rate = null as number | null,
    fee = 10,
  } = {}) {
    const created = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    await t.prisma.event.update({
      where: { id: created.event.id },
      data: { neoPassFeePercentage: fee },
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

  function paymentsProcessor() {
    return new PaymentsProcessor(t.app.get(PaymentsService));
  }

  // Mercado Pago aprueba el pago de la orden; mercadoPagoFee es la comisión
  // que informa (undefined: no la informa).
  function pay(
    order: { id: string; totalAmount: { toNumber(): number } },
    mercadoPagoFee?: number,
  ) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: order.id,
      transaction_amount: order.totalAmount.toNumber(),
      date_approved: '2026-10-28T15:00:00.000-03:00',
      money_release_date: '2026-10-28T15:00:00.000-03:00',
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
    return paymentsProcessor().process({
      name: 'process-payment',
      data: { paymentId: `pay-${order.id}` },
    } as Job);
  }

  function refund(order: { id: string }) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'refunded',
      external_reference: order.id,
    });
    return paymentsProcessor().process({
      name: 'process-payment',
      data: { paymentId: `pay-${order.id}` },
    } as Job);
  }

  function expire(order: { id: string }) {
    return new OrdersProcessor(t.app.get(OrdersService)).process({
      name: 'expire-order',
      data: { orderId: order.id },
    } as Job);
  }

  async function balanceOf(organizerId: string) {
    const organizer = await t.prisma.user.findUniqueOrThrow({
      where: { id: organizerId },
    });
    return organizer.mercadoPagoFeeBalance.toFixed(2);
  }

  function lastMarketplaceFee() {
    const calls = mercadoPagoMock.preferenceCreate.mock.calls;
    const [preference] = calls[calls.length - 1] as [
      { body: { marketplace_fee?: number } },
      string,
    ];
    return preference.body.marketplace_fee;
  }

  it('una venta en la que el organizador absorbió menos que su tercio le deja saldo a favor de NeoPass', async () => {
    // Se cobró con la tasa al instante (13,01 % / 6,99 %), pero Mercado Pago
    // le cobró a 35 días: $40,75 sobre $2260,20.
    const { organizer, ticketType } = await organizerWith();
    const order = await buy(ticketType.id);

    await pay(order, 40.75);

    const paid = await t.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(paid.feeDeviation?.toFixed(2)).toBe('93.23');
    expect(await balanceOf(organizer.id)).toBe('93.23');
  });

  it('la venta siguiente cobra el saldo sobre la parte de NeoPass, sin cambiar lo que paga el comprador', async () => {
    const { ticketType } = await organizerWith({
      balance: 93.23,
      rate: AT_35_DAYS,
    });

    const order = await buy(ticketType.id);

    expect(order.totalAmount.toFixed(2)).toBe('2213.40');
    expect(order.feeAdjustment.toFixed(2)).toBe('93.23');
    expect(order.marketplaceFee.toFixed(2)).toBe('279.83');
    expect(lastMarketplaceFee()).toBe(279.83);
  });

  it('cobra como máximo el 10 % de las entradas por venta y el resto queda para las siguientes', async () => {
    const { organizer, ticketType } = await organizerWith({
      balance: 500,
      rate: AT_35_DAYS,
    });

    const order = await buy(ticketType.id);
    expect(order.feeAdjustment.toFixed(2)).toBe('200.00');
    expect(order.marketplaceFee.toFixed(2)).toBe('386.60');

    await pay(order);
    expect(await balanceOf(organizer.id)).toBe('300.00');
  });

  it('dos compras en curso no cobran el mismo saldo dos veces', async () => {
    const { ticketType } = await organizerWith({
      balance: 150,
      rate: AT_35_DAYS,
    });

    const orders = await Promise.all([buy(ticketType.id), buy(ticketType.id)]);

    const adjustments = orders.map((order) => order.feeAdjustment.toFixed(2));
    expect(adjustments.sort()).toEqual(['0.00', '150.00']);
  });

  it('una compra que vence sin pagarse libera el saldo que tenía reservado', async () => {
    const { ticketType } = await organizerWith({
      balance: 150,
      rate: AT_35_DAYS,
    });
    const abandoned = await buy(ticketType.id);
    await expire(abandoned);

    const next = await buy(ticketType.id);

    expect(next.feeAdjustment.toFixed(2)).toBe('150.00');
  });

  it('una devolución le vuelve a sumar al organizador el saldo que la venta había cobrado', async () => {
    const { organizer, ticketType } = await organizerWith({
      balance: 93.23,
      rate: AT_35_DAYS,
    });
    const order = await buy(ticketType.id);
    await pay(order);
    expect(await balanceOf(organizer.id)).toBe('0.00');

    await refund(order);

    expect(await balanceOf(organizer.id)).toBe('93.23');
  });

  it('un evento sin cargo no cobra saldo ni genera desvío', async () => {
    const { organizer, ticketType } = await organizerWith({
      balance: 100,
      rate: AT_35_DAYS,
      fee: 0,
    });

    const order = await buy(ticketType.id);
    expect(order.feeAdjustment.toFixed(2)).toBe('0.00');
    expect(lastMarketplaceFee()).toBeUndefined();

    await pay(order, 159.72);
    expect(await balanceOf(organizer.id)).toBe('100.00');
  });

  it('una venta en la que el organizador absorbió más que su tercio le descuenta deuda', async () => {
    // Se cobró a 35 días, pero Mercado Pago le cobró al instante: $176,76.
    const { organizer, ticketType } = await organizerWith({
      balance: 300,
      rate: AT_35_DAYS,
    });
    const order = await buy(ticketType.id);

    await pay(order, 176.76);

    // 300 − 200 cobrados − 91,04 de desvío a su favor.
    expect(await balanceOf(organizer.id)).toBe('8.96');
  });

  it('una diferencia a favor del organizador nunca le deja crédito', async () => {
    const { organizer, ticketType } = await organizerWith({
      rate: AT_35_DAYS,
    });
    const order = await buy(ticketType.id);

    await pay(order, 176.76);

    const paid = await t.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(paid.feeDeviation?.toFixed(2)).toBe('-91.04');
    expect(await balanceOf(organizer.id)).toBe('0.00');
  });

  it('la base no deja un saldo negativo ni un ajuste mayor al 10 % de las entradas', async () => {
    const { organizer, ticketType } = await organizerWith({
      rate: AT_35_DAYS,
    });
    const order = await buy(ticketType.id);

    await expect(
      t.prisma
        .$executeRaw`UPDATE "User" SET "mercadoPagoFeeBalance" = -1 WHERE id = ${organizer.id}`,
    ).rejects.toThrow(/User_mercadoPagoFeeBalance_range/);
    await expect(
      t.prisma
        .$executeRaw`UPDATE "Order" SET "feeAdjustment" = 200.01, "marketplaceFee" = 386.61 WHERE id = ${order.id}`,
    ).rejects.toThrow(/Order_feeAdjustment_range/);
  });
});
