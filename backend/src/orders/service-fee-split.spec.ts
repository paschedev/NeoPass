import { Prisma } from '@prisma/client';
import { MERCADO_PAGO_FEE_RATE, splitServiceFee } from './service-fee-split';

describe('splitServiceFee', () => {
  it.each([
    ['12', '16.66'],
    ['10', '14.57'],
    ['8.5', '13.01'],
    ['6', '10.41'],
    ['2', '6.24'],
  ])(
    'con un cargo del %s %% el comprador paga %s %% y NeoPass se queda con el cargo completo',
    (fee, buyer) => {
      const split = splitServiceFee(fee);

      expect(split.buyerPercentage.toString()).toBe(buyer);
      expect(split.neoPassPercentage.toString()).toBe(fee);
    },
  );

  it.each(['0', '5', '10', '15', '20', '30'])(
    'con un cargo del %s %% el comprador y el organizador absorben casi la mitad de la comisión de Mercado Pago cada uno',
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
        organizer: price.sub(toOrganizer),
      };

      // NeoPass gets its whole fee, and rounding the half to two decimals
      // moves each part by less than $1 on a $10.000 ticket.
      expect(toNeoPass.toString()).toBe(percentOfPrice(fee).toString());
      const half = mercadoPago.div(2);
      for (const part of Object.values(absorbed)) {
        expect(part.sub(half).abs().toNumber()).toBeLessThan(1);
      }
    },
  );

  it('una entrada de $10.000 al 10 % le cuesta $11.457 al comprador y NeoPass recibe $1.000', () => {
    const split = splitServiceFee('10');
    const price = new Prisma.Decimal(10000);
    const total = price.add(price.mul(split.buyerPercentage).div(100));

    expect(total.toString()).toBe('11457');
    expect(price.mul(split.neoPassPercentage).div(100).toString()).toBe('1000');
    expect(
      total
        .mul(MERCADO_PAGO_FEE_RATE)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
        .toString(),
    ).toBe('914.96');
  });

  it('con la tasa real de un organizador que cobra a 35 días, el comprador paga un punto más que el cargo', () => {
    // 1,49 % + IVA = 1,803 %: la mitad es 1,00 punto en vez de 4,57.
    const split = splitServiceFee('10', '0.01803');

    expect(split.buyerPercentage.toString()).toBe('11');
    expect(split.neoPassPercentage.toString()).toBe('10');
  });

  it('un evento al 0 % también reparte: el comprador paga su mitad como cargo y NeoPass no recibe nada', () => {
    const split = splitServiceFee('0');

    expect(split.buyerPercentage.toString()).toBe('4.16');
    expect(split.neoPassPercentage.toString()).toBe('0');
  });
});
