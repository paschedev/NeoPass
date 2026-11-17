import { Prisma } from '@prisma/client';

// Mercado Pago charges the organizer its fee on the whole payment, NeoPass's
// service fee included. The rate depends on the release term the organizer
// chose; until one of their sales shows it (payments/mercado-pago-fee.ts), it
// assumes the highest, money available right away: 6.6 % + 21 % VAT = 7.986 %.
export const MERCADO_PAGO_FEE_RATE = new Prisma.Decimal('0.066').mul('1.21');

// The buyer and the organizer absorb half of that fee each, and NeoPass keeps
// the event's whole fee: the buyer pays the fee plus their half and the
// organizer absorbs the other half. Since the fee is also charged on the
// buyer's half, a half is r × (100 + fee) / (2 − r) points of the ticket
// price, rounded to two decimals. An event at 0 % splits too: the buyer pays
// only their half and NeoPass gets nothing.
// Mirrored in frontend/src/utils/service-fee-split.ts.
export function splitServiceFee(
  neoPassFeePercentage: Prisma.Decimal.Value,
  // The organizer's real rate; null if none of their sales showed it yet.
  mercadoPagoFeeRate?: Prisma.Decimal.Value | null,
) {
  const fee = new Prisma.Decimal(neoPassFeePercentage);
  const rate = new Prisma.Decimal(mercadoPagoFeeRate ?? MERCADO_PAGO_FEE_RATE);
  const half = rate
    .mul(fee.add(100))
    .div(new Prisma.Decimal(2).sub(rate))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { buyerPercentage: fee.add(half), neoPassPercentage: fee };
}
