import { describe, expect, it } from 'vitest';
import {
  buildPaymentSchema,
  formatAmountInput,
  parseAmount,
} from './promoter-payment';

describe('parseAmount', () => {
  it('entiende montos escritos como en Argentina', () => {
    expect(parseAmount('1500')).toBe(1500);
    expect(parseAmount('1.500')).toBe(1500);
    expect(parseAmount('1.500,50')).toBe(1500.5);
    expect(parseAmount('150,5')).toBe(150.5);
    expect(parseAmount(' $ 2.000 ')).toBe(2000);
  });

  it('también acepta el punto como decimal si no hay coma', () => {
    expect(parseAmount('150.50')).toBe(150.5);
  });

  it('un texto que no es un monto no es un número', () => {
    expect(parseAmount('mucho')).toBeNaN();
    expect(parseAmount('')).toBeNaN();
  });
});

describe('formatAmountInput', () => {
  it('propone el saldo como se escribe en el campo', () => {
    expect(formatAmountInput(200)).toBe('200');
    expect(formatAmountInput(150.5)).toBe('150,50');
  });
});

describe('buildPaymentSchema', () => {
  const schema = buildPaymentSchema(200);
  const errorOf = (values: { amount: string; note: string }) => {
    const result = schema.safeParse(values);
    return result.success ? null : result.error.issues[0].message;
  };

  it('acepta un monto hasta el saldo y devuelve el número y la nota limpia', () => {
    expect(schema.parse({ amount: '150,5', note: '  Efectivo ' })).toEqual({
      amount: 150.5,
      note: 'Efectivo',
    });
    expect(schema.parse({ amount: '200', note: '' })).toEqual({
      amount: 200,
      note: null,
    });
  });

  it('el monto tiene que ser mayor a 0 y no superar lo que se le debe', () => {
    expect(errorOf({ amount: '0', note: '' })).toBe(
      'El monto tiene que ser mayor a 0',
    );
    expect(errorOf({ amount: '200,01', note: '' })).toBe(
      'No puede superar lo que se le debe ($200)',
    );
    expect(errorOf({ amount: 'mucho', note: '' })).toBe('Poné un monto válido');
    expect(errorOf({ amount: '10,555', note: '' })).toBe(
      'El monto puede tener hasta dos decimales',
    );
  });

  it('la nota puede tener hasta 100 caracteres', () => {
    expect(errorOf({ amount: '10', note: 'a'.repeat(101) })).toBe(
      'La nota puede tener hasta 100 caracteres',
    );
  });
});
