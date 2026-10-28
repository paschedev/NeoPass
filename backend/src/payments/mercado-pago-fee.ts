import { Prisma } from '@prisma/client';
import type { Payment } from 'mercadopago';

type MercadoPagoPayment = Awaited<ReturnType<Payment['get']>>;

const DAY_MS = 24 * 60 * 60 * 1000;

// Mercado Pago's own fee on a payment, the one the organizer pays. The
// financing of interest-free installments and NeoPass's marketplace_fee come
// apart and don't count. Null if Mercado Pago didn't detail its fees.
export function mercadoPagoFeeOf({
  fee_details,
}: Pick<MercadoPagoPayment, 'fee_details'>) {
  if (!fee_details) return null;
  return fee_details
    .filter(
      (fee) => fee.type === 'mercadopago_fee' && fee.fee_payer === 'collector',
    )
    .reduce((sum, fee) => sum.plus(fee.amount ?? 0), new Prisma.Decimal(0))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

// The fee of a combined payment: the sum of its parts', unknown if any part
// came without it.
export function sumMercadoPagoFees(
  parts: { mercadoPagoFee: Prisma.Decimal | null }[],
) {
  let total = new Prisma.Decimal(0);
  for (const { mercadoPagoFee } of parts) {
    if (!mercadoPagoFee) return null;
    total = total.plus(mercadoPagoFee);
  }
  return total;
}

// The release term the organizer chose: days from the approval of the
// payment until its money is released (0 = right away).
export function releaseDaysOf({
  date_approved,
  money_release_date,
}: Pick<MercadoPagoPayment, 'date_approved' | 'money_release_date'>) {
  if (!date_approved || !money_release_date) return null;
  const days = Math.round(
    (Date.parse(money_release_date) - Date.parse(date_approved)) / DAY_MS,
  );
  return Math.max(0, days);
}
