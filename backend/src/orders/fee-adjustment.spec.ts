import { Prisma } from '@prisma/client';
import {
  adjustmentCapOf,
  feeAdjustmentFor,
  feeDeviationOf,
} from './fee-adjustment';

const d = (value: string) => new Prisma.Decimal(value);

describe('feeDeviationOf', () => {
  it('cuenta cuánto menos que su tercio de la comisión real absorbió el organizador', () => {
    // Cobró con la tasa al instante y Mercado Pago le cobró a 35 días.
    const deviation = feeDeviationOf({
      serviceFee: d('260.20'),
      marketplaceFee: d('139.80'),
      feeAdjustment: d('0'),
      mercadoPagoFee: d('40.75'),
    });

    expect(deviation?.toFixed(2)).toBe('93.23');
  });

  it('el ajuste que cobró la venta no cuenta como desvío', () => {
    const deviation = feeDeviationOf({
      serviceFee: d('213.40'),
      marketplaceFee: d('279.83'),
      feeAdjustment: d('93.23'),
      mercadoPagoFee: d('39.91'),
    });

    expect(deviation?.toFixed(2)).toBe('0.19');
  });

  it('si absorbió más que su tercio, el desvío es negativo', () => {
    const deviation = feeDeviationOf({
      serviceFee: d('213.40'),
      marketplaceFee: d('186.60'),
      feeAdjustment: d('0'),
      mercadoPagoFee: d('176.76'),
    });

    expect(deviation?.toFixed(2)).toBe('-91.04');
  });

  it('sin comisión informada o en un evento sin cargo no hay desvío', () => {
    const sale = {
      serviceFee: d('260.20'),
      marketplaceFee: d('139.80'),
      feeAdjustment: d('0'),
    };

    expect(feeDeviationOf({ ...sale, mercadoPagoFee: null })).toBeNull();
    expect(
      feeDeviationOf({
        serviceFee: d('0'),
        marketplaceFee: d('0'),
        feeAdjustment: d('0'),
        mercadoPagoFee: d('159.72'),
      }),
    ).toBeNull();
  });
});

describe('adjustmentCapOf', () => {
  it('una venta cobra como máximo el 10 % de sus entradas, sin redondear hacia arriba', () => {
    expect(adjustmentCapOf(d('2000'), d('260.20')).toFixed(2)).toBe('200.00');
    expect(adjustmentCapOf(d('333.33'), d('60.50')).toFixed(2)).toBe('33.33');
  });

  it('una venta sin cargo no cobra saldo', () => {
    expect(adjustmentCapOf(d('2000'), d('0')).toFixed(2)).toBe('0.00');
  });
});

describe('feeAdjustmentFor', () => {
  it('cobra el saldo que no reservó otra compra en curso, hasta el tope', () => {
    expect(feeAdjustmentFor(d('93.23'), d('0'), d('200')).toFixed(2)).toBe(
      '93.23',
    );
    expect(feeAdjustmentFor(d('500'), d('0'), d('200')).toFixed(2)).toBe(
      '200.00',
    );
    expect(feeAdjustmentFor(d('150'), d('100'), d('200')).toFixed(2)).toBe(
      '50.00',
    );
  });

  it('nunca es negativo', () => {
    expect(feeAdjustmentFor(d('100'), d('150'), d('200')).toFixed(2)).toBe(
      '0.00',
    );
  });
});
