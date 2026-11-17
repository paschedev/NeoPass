import { describe, expect, it } from 'vitest';
import { splitServiceFee } from './service-fee-split';

// Mismos casos que backend/src/orders/service-fee-split.spec.ts.
describe('splitServiceFee', () => {
  it.each([
    ['12', 16.66, 12],
    ['10', 14.57, 10],
    ['8.5', 13.01, 8.5],
    ['6', 10.41, 6],
    ['2', 6.24, 2],
  ])(
    'con un cargo del %s %% el comprador paga %s %% y NeoPass se queda con el cargo completo',
    (fee, buyer, neoPass) => {
      expect(splitServiceFee(fee)).toEqual({
        buyerPercentage: buyer,
        neoPassPercentage: neoPass,
      });
    },
  );

  it('un evento al 0 % también reparte: el comprador paga su mitad como cargo y NeoPass no recibe nada', () => {
    expect(splitServiceFee('0')).toEqual({
      buyerPercentage: 4.16,
      neoPassPercentage: 0,
    });
  });
});
