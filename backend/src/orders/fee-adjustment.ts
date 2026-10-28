import { Prisma } from '@prisma/client';

const ZERO = new Prisma.Decimal(0);

// A sale collects at most this share of its tickets' value from the
// organizer's balance, so none of their sales arrives almost empty.
const MAX_ADJUSTMENT_SHARE = new Prisma.Decimal('0.1');

// How much less than their third of Mercado Pago's real fee the organizer
// absorbed in a paid sale (negative: more). The organizer should receive the
// tickets minus a third of the fee; everything else the buyer paid on top is
// NeoPass's. The adjustment the sale collected doesn't count. Null if Mercado
// Pago didn't report its fee, or for an event without a fee (no split).
export function feeDeviationOf(sale: {
  serviceFee: Prisma.Decimal;
  marketplaceFee: Prisma.Decimal;
  feeAdjustment: Prisma.Decimal;
  mercadoPagoFee: Prisma.Decimal | null;
}) {
  if (!sale.mercadoPagoFee || sale.serviceFee.isZero()) return null;
  const twoThirds = sale.mercadoPagoFee
    .mul(2)
    .div(3)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return sale.serviceFee
    .sub(sale.marketplaceFee.sub(sale.feeAdjustment))
    .sub(twoThirds);
}

// The most a sale can collect from the organizer's balance: 10 % of its
// tickets, rounded down so it never goes over. A sale without a service fee
// (an event at 0 %) collects nothing.
export function adjustmentCapOf(
  ticketAmount: Prisma.Decimal,
  serviceFee: Prisma.Decimal,
) {
  if (serviceFee.isZero()) return ZERO;
  return ticketAmount
    .mul(MAX_ADJUSTMENT_SHARE)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
}

// What a new sale collects: the balance that other unpaid sales haven't
// reserved yet, up to the cap.
export function feeAdjustmentFor(
  balance: Prisma.Decimal,
  reserved: Prisma.Decimal,
  cap: Prisma.Decimal,
) {
  return Prisma.Decimal.max(
    ZERO,
    Prisma.Decimal.min(balance.sub(reserved), cap),
  );
}
