import { describe, expect, it } from 'vitest';
import {
  MAX_TICKETS_PER_ORDER,
  calculateCheckoutTotals,
  updateCart,
} from './checkout';

const GENERAL = { id: 'general', price: '1000.00' };
const VIP = { id: 'vip', price: '2500.50' };

describe('calculateCheckoutTotals', () => {
  it('con el carrito vacío todo es cero', () => {
    expect(calculateCheckoutTotals([GENERAL], {}, '18.15')).toEqual({
      tickets: 0,
      subtotal: 0,
      serviceFee: 0,
      total: 0,
    });
  });

  it('suma las entradas elegidas y agrega el porcentaje que paga el comprador', () => {
    // Un evento al 10 % con la tasa al instante: el comprador paga 13,01 %.
    expect(
      calculateCheckoutTotals([GENERAL, VIP], { general: 2, vip: 1 }, '13.01'),
    ).toEqual({
      tickets: 3,
      subtotal: 4500.5,
      serviceFee: 585.52,
      total: 5086.02,
    });
  });

  it('redondea el cargo a centavos hacia arriba en la mitad, como el backend', () => {
    // 10,00 × 18,15 % = 1,815 → 1,82 (no 1,81)
    expect(
      calculateCheckoutTotals([{ id: 'x', price: '10.00' }], { x: 1 }, '18.15')
        .serviceFee,
    ).toBe(1.82);
  });

  it('si el comprador no paga cargo, el total son las entradas', () => {
    expect(
      calculateCheckoutTotals([GENERAL], { general: 1 }, '0'),
    ).toMatchObject({ serviceFee: 0, total: 1000 });
  });
});

describe('updateCart', () => {
  it('suma y resta entradas de un tipo', () => {
    const cart = updateCart({}, 'general', 1, 100);
    expect(updateCart(cart, 'general', 1, 100)).toEqual({ general: 2 });
    expect(updateCart({ general: 1 }, 'general', -1, 100)).toEqual({});
  });

  it('no baja de cero ni pasa de lo disponible', () => {
    expect(updateCart({}, 'general', -1, 100)).toEqual({});
    expect(updateCart({ general: 2 }, 'general', 1, 2)).toEqual({ general: 2 });
  });

  it(`no deja pasar de ${MAX_TICKETS_PER_ORDER} entradas entre todos los tipos`, () => {
    const full = { general: 6, vip: 4 };

    expect(updateCart(full, 'vip', 1, 100)).toBe(full);
    expect(updateCart(full, 'general', -1, 100)).toEqual({
      general: 5,
      vip: 4,
    });
  });
});
