import { Prisma } from '@prisma/client';

// A payment to a promoter as the panels show it.
export const toPaymentRecord = ({
  amount,
  note,
  createdAt,
}: {
  amount: Prisma.Decimal;
  note: string | null;
  createdAt: Date;
}) => ({ amount: amount.toNumber(), note, createdAt });
