import { describe, expect, it } from 'vitest';
import {
  formatPercentage,
  parsePercentage,
  serviceFeeExample,
  serviceFeeSchema,
} from './service-fee';

const errorOf = (percentage: string) => {
  const result = serviceFeeSchema.safeParse({ percentage });
  return result.success ? null : result.error.issues[0].message;
};

describe('parsePercentage', () => {
  it.each([
    ['8', 8],
    ['8,5', 8.5],
    ['8.5', 8.5],
    ['0', 0],
    ['100', 100],
    [' 12,25 % ', 12.25],
  ])('lee "%s" como %s', (text, expected) => {
    expect(parsePercentage(text)).toBe(expected);
  });

  it.each(['', 'abc', '-1', '8,5,1', '1000'])(
    '"%s" no es un porcentaje',
    (text) => {
      expect(parsePercentage(text)).toBeNaN();
    },
  );
});

describe('serviceFeeSchema', () => {
  it('acepta de 0 a 100 con hasta dos decimales, escritos con coma o punto', () => {
    expect(serviceFeeSchema.parse({ percentage: '8,55' })).toEqual({
      percentage: 8.55,
    });
    expect(serviceFeeSchema.parse({ percentage: '0' })).toEqual({
      percentage: 0,
    });
    expect(serviceFeeSchema.parse({ percentage: '100' })).toEqual({
      percentage: 100,
    });
  });

  it('rechaza más de 100', () => {
    expect(errorOf('100,01')).toBe('El cargo puede ser de hasta 100 %');
  });

  it('rechaza más de dos decimales', () => {
    expect(errorOf('8,555')).toBe('El cargo puede tener hasta dos decimales');
  });

  it.each(['', 'ocho', '-1'])('rechaza "%s"', (text) => {
    expect(errorOf(text)).toBe('Poné un porcentaje válido');
  });
});

describe('serviceFeeExample', () => {
  it('muestra cuánto paga quien compra una entrada de $10.000, cuánto se queda NeoPass y cuánto recibe el organizador después de Mercado Pago', () => {
    expect(serviceFeeExample(8.5)).toEqual({
      price: 10000,
      serviceFee: 1147,
      total: 11147,
      neoPassFee: 553,
      organizerNet: 9703.8,
    });
    expect(serviceFeeExample(15)).toEqual({
      price: 10000,
      serviceFee: 1815,
      total: 11815,
      neoPassFee: 1185,
      organizerNet: 9686.45,
    });
  });

  it('con 0 % el organizador absorbe toda la comisión de Mercado Pago', () => {
    expect(serviceFeeExample(0)).toEqual({
      price: 10000,
      serviceFee: 0,
      total: 10000,
      neoPassFee: 0,
      organizerNet: 9201.4,
    });
  });
});

describe('formatPercentage', () => {
  it('muestra el cargo como lo lee alguien en Argentina', () => {
    expect(formatPercentage('8.5')).toBe('8,5 %');
    expect(formatPercentage('15')).toBe('15 %');
    expect(formatPercentage(12.25)).toBe('12,25 %');
  });
});
