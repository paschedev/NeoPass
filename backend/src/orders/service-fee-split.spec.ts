import { Prisma } from '@prisma/client';
import { MERCADO_PAGO_FEE_RATE, splitServiceFee } from './service-fee-split';

describe('splitServiceFee', () => {
  it.each([
    ['15', '18.15', '11.85'],
    ['10', '13.01', '6.99'],
    ['8.5', '11.47', '5.53'],
  ])(
    'con un cargo del %s %% el comprador paga %s %% y NeoPass se queda con %s %%',
    (fee, buyer, neoPass) => {
      const split = splitServiceFee(fee);

      expect(split.buyerPercentage.toString()).toBe(buyer);
      expect(split.neoPassPercentage.toString()).toBe(neoPass);
    },
  );

  it.each(['5', '10', '15', '20', '30'])(
    'con un cargo del %s %% comprador, NeoPass y organizador absorben casi lo mismo de la comisión de Mercado Pago',
    (fee) => {
      const price = new Prisma.Decimal(10000);
      const { buyerPercentage, neoPassPercentage } = splitServiceFee(fee);
      const percentOfPrice = (percentage: Prisma.Decimal.Value) =>
        price.mul(percentage).div(100);

      const paid = price.add(percentOfPrice(buyerPercentage));
      const toNeoPass = percentOfPrice(neoPassPercentage);
      const mercadoPago = paid.mul(MERCADO_PAGO_FEE_RATE);
      const toOrganizer = paid.sub(toNeoPass).sub(mercadoPago);
      const absorbed = {
        buyer: paid.sub(price).sub(percentOfPrice(fee)),
        neoPass: percentOfPrice(fee).sub(toNeoPass),
        organizer: price.sub(toOrganizer),
      };

      // Rounding the share to two decimals moves each part by less than $2
      // on a $10.000 ticket.
      const third = mercadoPago.div(3);
      for (const part of Object.values(absorbed)) {
        expect(part.sub(third).abs().toNumber()).toBeLessThan(2);
      }
    },
  );

  it('con la tasa real de un organizador que cobra a 35 días, los tercios son más chicos', () => {
    // 1,49 % + IVA = 1,803 %: el tercio es 0,67 puntos en vez de 3,01.
    const split = splitServiceFee('10', '0.01803');

    expect(split.buyerPercentage.toString()).toBe('10.67');
    expect(split.neoPassPercentage.toString()).toBe('9.33');
  });

  it('si el cargo no alcanza para su tercio, NeoPass se queda sin nada y el comprador paga solo su parte', () => {
    const split = splitServiceFee('2');

    expect(split.buyerPercentage.toString()).toBe('4.79');
    expect(split.neoPassPercentage.toString()).toBe('0');
  });

  it('un evento sin cargo no reparte: el comprador paga solo las entradas', () => {
    const split = splitServiceFee('0');

    expect(split.buyerPercentage.toString()).toBe('0');
    expect(split.neoPassPercentage.toString()).toBe('0');
  });
});
