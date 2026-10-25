import { Prisma } from '@prisma/client';

// Mercado Pago charges the organizer its fee on the whole payment, NeoPass's
// service fee included. It assumes the highest rate, money available right
// away: 6.6 % + 21 % VAT = 7.986 %.
export const MERCADO_PAGO_FEE_RATE = new Prisma.Decimal('0.066').mul('1.21');

const ZERO = new Prisma.Decimal(0);

// The buyer, NeoPass and the organizer absorb a third of that fee each: the
// buyer pays the event's fee plus their third, NeoPass keeps its fee minus the
// same third (never below zero) and the organizer absorbs the rest. Since the
// fee is also charged on the buyer's third, a third is r × (100 + fee) /
// (3 − r) points of the ticket price, rounded to two decimals. An event at 0 %
// doesn't split: the buyer pays only the tickets.
// Mirrored in frontend/src/utils/service-fee-split.ts.
export function splitServiceFee(neoPassFeePercentage: Prisma.Decimal.Value) {
  const fee = new Prisma.Decimal(neoPassFeePercentage);
  if (fee.isZero()) return { buyerPercentage: ZERO, neoPassPercentage: ZERO };

  const share = MERCADO_PAGO_FEE_RATE.mul(fee.add(100))
    .div(new Prisma.Decimal(3).sub(MERCADO_PAGO_FEE_RATE))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return {
    buyerPercentage: fee.add(share),
    neoPassPercentage: Prisma.Decimal.max(fee.sub(share), ZERO),
  };
}
