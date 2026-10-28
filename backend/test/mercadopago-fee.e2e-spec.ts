import { Job } from 'bullmq';
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

// Una orden de 2 entradas de $1000. Al instante, Mercado Pago cobra 7,986 %
// (6,6 % + IVA): $159,72 sobre $2000.
const TOTAL = 2000;
const INSTANT_FEE = 159.72;
const APPROVED_AT = '2026-10-27T15:00:00.000-03:00';

function mercadoPagoFee(amount: number) {
  return { type: 'mercadopago_fee', amount, fee_payer: 'collector' };
}

describe('Comisión real de Mercado Pago', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function pendingOrder() {
    const { organizer, ticketType } = await createOrganizerWithEvent(t.prisma, {
      price: 1000,
    });
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });
    return { organizer, ticketType, buyer, order };
  }

  function pay(
    paymentId: string,
    orderId: string,
    extra: Record<string, unknown> = {},
  ) {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: orderId,
      transaction_amount: TOTAL,
      date_approved: APPROVED_AT,
      money_release_date: APPROVED_AT,
      fee_details: [mercadoPagoFee(INSTANT_FEE)],
      ...extra,
    });
    return new PaymentsProcessor(t.app.get(PaymentsService)).process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  async function orderFee(orderId: string) {
    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    return order.mercadoPagoFee?.toFixed(2) ?? null;
  }

  async function organizerTerms(organizerId: string) {
    const organizer = await t.prisma.user.findUniqueOrThrow({
      where: { id: organizerId },
    });
    return {
      rate: organizer.mercadoPagoFeeRate?.toString() ?? null,
      releaseDays: organizer.mercadoPagoReleaseDays,
    };
  }

  it('una venta pagada guarda la comisión que cobró Mercado Pago', async () => {
    const { order } = await pendingOrder();

    await pay('pay-1', order.id);

    expect(await orderFee(order.id)).toBe('159.72');
  });

  it('el organizador queda con la tasa y el plazo de cobro de su última venta', async () => {
    const { organizer, order } = await pendingOrder();

    // A 35 días: 1,49 % + IVA = 1,8029 % → $36,06 sobre $2000.
    await pay('pay-1', order.id, {
      fee_details: [mercadoPagoFee(36.06)],
      money_release_date: '2026-12-01T15:00:00.000-03:00',
    });

    expect(await organizerTerms(organizer.id)).toEqual({
      rate: '0.01803',
      releaseDays: 35,
    });
  });

  it('una venta que se libera al instante deja el plazo en 0 días', async () => {
    const { organizer, order } = await pendingOrder();

    await pay('pay-1', order.id);

    expect(await organizerTerms(organizer.id)).toEqual({
      rate: '0.07986',
      releaseDays: 0,
    });
  });

  it('la financiación de cuotas sin interés no cuenta como comisión', async () => {
    const { organizer, order } = await pendingOrder();

    await pay('pay-1', order.id, {
      fee_details: [
        mercadoPagoFee(INSTANT_FEE),
        { type: 'financing_fee', amount: 240, fee_payer: 'collector' },
        { type: 'application_fee', amount: 200, fee_payer: 'collector' },
      ],
    });

    expect(await orderFee(order.id)).toBe('159.72');
    expect((await organizerTerms(organizer.id)).rate).toBe('0.07986');
  });

  it('un pago combinado suma la comisión de sus partes', async () => {
    const { organizer, order } = await pendingOrder();

    await pay('pay-account', order.id, {
      transaction_amount: 1200,
      fee_details: [mercadoPagoFee(95.83)],
    });
    await pay('pay-card', order.id, {
      transaction_amount: 800,
      fee_details: [mercadoPagoFee(63.89)],
    });

    expect(await orderFee(order.id)).toBe('159.72');
    expect((await organizerTerms(organizer.id)).rate).toBe('0.07986');
  });

  it('una venta aprobada antes que la última registrada no pisa la tasa', async () => {
    const { organizer, ticketType, buyer, order } = await pendingOrder();
    const older = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity: 2,
    });

    await pay('pay-new', order.id);
    // Llega tarde la notificación de una venta del día anterior, a 35 días.
    await pay('pay-old', older.id, {
      fee_details: [mercadoPagoFee(36.06)],
      date_approved: '2026-10-26T15:00:00.000-03:00',
      money_release_date: '2026-11-30T15:00:00.000-03:00',
    });

    expect(await orderFee(older.id)).toBe('36.06');
    expect(await organizerTerms(organizer.id)).toEqual({
      rate: '0.07986',
      releaseDays: 0,
    });
  });

  it('un pago sin comisión informada no cambia la tasa del organizador', async () => {
    const { organizer, order } = await pendingOrder();
    await t.prisma.user.update({
      where: { id: organizer.id },
      data: { mercadoPagoFeeRate: 0.01803, mercadoPagoReleaseDays: 35 },
    });

    await pay('pay-1', order.id, { fee_details: undefined });

    expect(await orderFee(order.id)).toBeNull();
    expect(await organizerTerms(organizer.id)).toEqual({
      rate: '0.01803',
      releaseDays: 35,
    });
  });
});
