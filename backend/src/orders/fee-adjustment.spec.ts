import { Prisma } from '@prisma/client';
import {
  adjustmentCapOf,
  feeAdjustmentFor,
  feeDeviationOf,
} from './fee-adjustment';

const d = (value: string) => new Prisma.Decimal(value);

describe('feeDeviationOf', () => {
  it('cuenta cuánto menos que su mitad de la comisión real absorbió el organizador', () => {
    // Cobró con la tasa al instante y Mercado Pago le cobró a 35 días.
    const deviation = feeDeviationOf({
      serviceFee: d('291.40'),
      marketplaceFee: d('200.00'),
      feeAdjustment: d('0'),
      mercadoPagoFee: d('41.31'),
    });

    expect(deviation?.toFixed(2)).toBe('70.74');
  });

  it('el ajuste que cobró la venta no cuenta como desvío', () => {
    const deviation = feeDeviationOf({
      serviceFee: d('220.00'),
      marketplaceFee: d('270.74'),
      feeAdjustment: d('70.74'),
      mercadoPagoFee: d('40.03'),
    });

    expect(deviation?.toFixed(2)).toBe('-0.02');
  });

  it('si absorbió más que su mitad, el desvío es negativo', () => {
    const deviation = feeDeviationOf({
      serviceFee: d('220.00'),
      marketplaceFee: d('200.00'),
      feeAdjustment: d('0'),
      mercadoPagoFee: d('177.29'),
    });

    expect(deviation?.toFixed(2)).toBe('-68.65');
  });

  it('un evento al 0 % también genera desvío', () => {
    // Cobró la mitad al instante (4,16 %) y Mercado Pago le cobró a 35 días.
    const deviation = feeDeviationOf({
      serviceFee: d('83.20'),
      marketplaceFee: d('100.00'),
      feeAdjustment: d('100.00'),
      mercadoPagoFee: d('37.56'),
    });

    expect(deviation?.toFixed(2)).toBe('64.42');
  });

  it('sin comisión informada no hay desvío', () => {
    expect(
      feeDeviationOf({
        serviceFee: d('291.40'),
        marketplaceFee: d('200.00'),
        feeAdjustment: d('0'),
        mercadoPagoFee: null,
      }),
    ).toBeNull();
  });
});

describe('adjustmentCapOf', () => {
  it('una venta cobra como máximo el 10 % de sus entradas, sin redondear hacia arriba', () => {
    expect(adjustmentCapOf(d('2000')).toFixed(2)).toBe('200.00');
    expect(adjustmentCapOf(d('333.33')).toFixed(2)).toBe('33.33');
  });
});

describe('feeAdjustmentFor', () => {
  it('cobra el saldo que no reservó otra compra en curso, hasta el tope', () => {
    expect(feeAdjustmentFor(d('70.74'), d('0'), d('200')).toFixed(2)).toBe(
      '70.74',
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
