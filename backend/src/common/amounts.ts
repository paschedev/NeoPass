// Largest value a Decimal(10, 2) column holds; anything above overflows it.
export const MAX_AMOUNT = 99_999_999.99;

// A peso amount as users read it in messages: "$1.234" or "$1.234,50".
export function formatPesos(amount: number): string {
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  })}`;
}
