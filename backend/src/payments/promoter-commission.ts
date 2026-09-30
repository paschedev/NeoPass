import { CommissionType, Prisma } from '@prisma/client';

type PromoterCommissionRule = {
  commissionType: CommissionType | null;
  commissionValue: Prisma.Decimal | null;
};

// What a promoter earns with one order, rounded to cents (half up): a
// percentage of the tickets' value, or a fixed amount per ticket.
export function calculatePromoterCommission(
  { commissionType, commissionValue }: PromoterCommissionRule,
  order: { ticketAmount: Prisma.Decimal.Value; ticketCount: number },
) {
  if (!commissionType || !commissionValue) return new Prisma.Decimal(0);

  const commission =
    commissionType === 'PERCENTAGE'
      ? new Prisma.Decimal(order.ticketAmount).mul(commissionValue).div(100)
      : commissionValue.mul(order.ticketCount);
  return commission.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
