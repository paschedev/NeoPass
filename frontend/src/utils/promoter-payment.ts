import { z } from 'zod';
import { formatCurrency } from './format';

// Un monto como lo escribe alguien en Argentina: "1.500,50", "1500", "150.50".
// Con coma, los puntos son de miles; sin coma, el punto es el decimal.
export function parseAmount(text: string): number {
  const clean = text.replace(/[$\s]/g, '');
  if (clean === '') return NaN;
  const normalized = clean.includes(',')
    ? clean.replace(/\./g, '').replace(',', '.')
    : /^\d{1,3}(\.\d{3})+$/.test(clean)
      ? clean.replace(/\./g, '')
      : clean;
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}

// El saldo propuesto en el campo del monto.
export function formatAmountInput(amount: number): string {
  return Number.isInteger(amount)
    ? String(amount)
    : amount.toFixed(2).replace('.', ',');
}

const hasAtMostTwoDecimals = (amount: number) =>
  Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6;

// Espejo de RegisterPromoterPaymentDto: el servidor además frena un pago que
// supere el saldo aunque otro lo haya registrado recién.
export function buildPaymentSchema(balance: number) {
  return z.object({
    amount: z
      .string()
      .transform(parseAmount)
      .pipe(
        z
          .number({ error: 'Poné un monto válido' })
          .refine(Number.isFinite, 'Poné un monto válido')
          .refine((amount) => amount > 0, 'El monto tiene que ser mayor a 0')
          .refine(
            hasAtMostTwoDecimals,
            'El monto puede tener hasta dos decimales',
          )
          .refine(
            (amount) => amount <= balance,
            `No puede superar lo que se le debe (${formatCurrency(balance)})`,
          ),
      ),
    note: z
      .string()
      .trim()
      .max(100, 'La nota puede tener hasta 100 caracteres')
      .transform((note) => note || null),
  });
}

export type PaymentFormInput = z.input<ReturnType<typeof buildPaymentSchema>>;
export type PaymentFormOutput = z.output<ReturnType<typeof buildPaymentSchema>>;
