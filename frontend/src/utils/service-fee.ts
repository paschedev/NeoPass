import { z } from 'zod';
import { calculateCheckoutTotals } from './checkout';
import { formatCurrency } from './format';
import { MERCADO_PAGO_FEE_RATE, splitServiceFee } from './service-fee-split';

// Un porcentaje como lo escribe alguien en Argentina: "8", "8,5" o "8.5".
export function parsePercentage(text: string): number {
  const clean = text.replace('%', '').trim();
  return /^\d{1,3}([.,]\d+)?$/.test(clean)
    ? Number(clean.replace(',', '.'))
    : NaN;
}

const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

// Espejo de UpdateServiceFeeDto.
export const serviceFeeSchema = z.object({
  percentage: z
    .string()
    .transform(parsePercentage)
    .pipe(
      z
        .number({ error: 'Poné un porcentaje válido' })
        .refine(Number.isFinite, 'Poné un porcentaje válido')
        .refine((value) => value <= 100, 'El cargo puede ser de hasta 100 %')
        .refine(
          hasAtMostTwoDecimals,
          'El cargo puede tener hasta dos decimales',
        ),
    ),
});

export type ServiceFeeInput = z.input<typeof serviceFeeSchema>;
export type ServiceFeeOutput = z.output<typeof serviceFeeSchema>;

const EXAMPLE_PRICE = 10000;

const toCents = (amount: number) => Math.round(amount * 100);

// Lo que paga quien compra una entrada de $10.000 con ese cargo (con el
// mismo redondeo que la página del evento), lo que se queda NeoPass y lo que
// recibe el organizador después de la comisión de Mercado Pago.
export function serviceFeeExample(percentage: number) {
  const { buyerPercentage, neoPassPercentage } = splitServiceFee(percentage);
  const { serviceFee, total } = calculateCheckoutTotals(
    [{ id: 'ejemplo', price: EXAMPLE_PRICE }],
    { ejemplo: 1 },
    buyerPercentage,
  );
  const neoPassCents = Math.round(
    (toCents(EXAMPLE_PRICE) * Math.round(neoPassPercentage * 100)) / 10_000,
  );
  const mercadoPagoCents = Math.round(toCents(total) * MERCADO_PAGO_FEE_RATE);
  return {
    price: EXAMPLE_PRICE,
    serviceFee,
    total,
    neoPassFee: neoPassCents / 100,
    organizerNet: (toCents(total) - neoPassCents - mercadoPagoCents) / 100,
  };
}

// "8.5" (un Decimal de la API) → "8,5 %".
export function formatPercentage(value: string | number): string {
  return `${Number(value).toLocaleString('es-AR')} %`;
}

// Cómo le cobra Mercado Pago a un organizador, según su última venta, y lo
// que le debe a NeoPass por absorber menos que su tercio de la comisión.
// Decimales de la base: llegan como string.
export interface MercadoPagoTerms {
  mercadoPagoReleaseDays: number | null;
  mercadoPagoFeeRate: string | null;
  mercadoPagoFeeBalance: string;
}

// "Mercado Pago: cobra a 35 días · 1,803 % · Debe $93,23".
export function mercadoPagoTermsLabel({
  mercadoPagoReleaseDays: days,
  mercadoPagoFeeRate: rate,
  mercadoPagoFeeBalance: balance,
}: MercadoPagoTerms): string {
  const parts = ['Mercado Pago: sin ventas todavía'];
  if (rate !== null) {
    const term =
      days === null
        ? 'plazo sin datos'
        : days === 0
          ? 'al instante'
          : `a ${days} ${days === 1 ? 'día' : 'días'}`;
    parts[0] = `Mercado Pago: cobra ${term}`;
    parts.push(formatPercentage((Number(rate) * 100).toFixed(3)));
  }
  if (Number(balance) > 0) parts.push(`Debe ${formatCurrency(balance)}`);
  return parts.join(' · ');
}
