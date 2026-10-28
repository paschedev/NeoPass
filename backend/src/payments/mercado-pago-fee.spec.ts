import { mercadoPagoFeeOf, releaseDaysOf } from './mercado-pago-fee';

describe('mercadoPagoFeeOf', () => {
  it('suma solo la comisión de Mercado Pago que paga el organizador', () => {
    const fee = mercadoPagoFeeOf({
      fee_details: [
        { type: 'mercadopago_fee', amount: 100.1, fee_payer: 'collector' },
        { type: 'mercadopago_fee', amount: 0.2, fee_payer: 'collector' },
        { type: 'mercadopago_fee', amount: 50, fee_payer: 'payer' },
        { type: 'financing_fee', amount: 240, fee_payer: 'collector' },
        { type: 'application_fee', amount: 200, fee_payer: 'collector' },
      ],
    });

    expect(fee?.toFixed(2)).toBe('100.30');
  });

  it('sin detalle de comisiones no hay comisión conocida', () => {
    expect(mercadoPagoFeeOf({})).toBeNull();
  });

  it('con detalle pero sin comisión de Mercado Pago, la comisión es 0', () => {
    expect(mercadoPagoFeeOf({ fee_details: [] })?.toFixed(2)).toBe('0.00');
  });
});

describe('releaseDaysOf', () => {
  it('cuenta los días entre la aprobación y la liberación del dinero', () => {
    expect(
      releaseDaysOf({
        date_approved: '2026-10-27T23:30:00.000-03:00',
        money_release_date: '2026-11-10T23:30:00.000-03:00',
      }),
    ).toBe(14);
  });

  it('una liberación unos minutos después de aprobar es al instante', () => {
    expect(
      releaseDaysOf({
        date_approved: '2026-10-27T15:00:00.000-03:00',
        money_release_date: '2026-10-27T15:04:00.000-03:00',
      }),
    ).toBe(0);
  });

  it('sin alguna de las dos fechas no hay plazo conocido', () => {
    expect(
      releaseDaysOf({ date_approved: '2026-10-27T15:00:00.000-03:00' }),
    ).toBeNull();
  });
});
