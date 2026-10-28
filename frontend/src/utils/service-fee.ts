import { z } from 'zod';
import { calculateCheckoutTotals } from './checkout';
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
