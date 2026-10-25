import { describe, expect, it } from 'vitest';
import { splitServiceFee } from './service-fee-split';

// Mismos casos que backend/src/orders/service-fee-split.spec.ts.
describe('splitServiceFee', () => {
  it.each([
    ['15', 18.15, 11.85],
    ['10', 13.01, 6.99],
    ['8.5', 11.47, 5.53],
  ])(
    'con un cargo del %s %% el comprador paga %s %% y NeoPass se queda con %s %%',
    (fee, buyer, neoPass) => {
      expect(splitServiceFee(fee)).toEqual({
        buyerPercentage: buyer,
        neoPassPercentage: neoPass,
      });
    },
  );

  it('si el cargo no alcanza para su tercio, NeoPass se queda sin nada y el comprador paga solo su parte', () => {
    expect(splitServiceFee(2)).toEqual({
      buyerPercentage: 4.79,
      neoPassPercentage: 0,
    });
  });

  it('un evento sin cargo no reparte: el comprador paga solo las entradas', () => {
    expect(splitServiceFee('0')).toEqual({
      buyerPercentage: 0,
      neoPassPercentage: 0,
    });
  });
});
