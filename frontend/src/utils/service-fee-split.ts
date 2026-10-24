// Mercado Pago le cobra al organizador su comisión sobre todo el pago. Se toma
// la tasa más alta (el dinero disponible al instante): 6,6 % + 21 % de IVA =
// 7,986 %, expresada sobre 100.000 para operar con enteros.
const MERCADO_PAGO_FEE_PER_100K = 7986;

export const MERCADO_PAGO_FEE_RATE = MERCADO_PAGO_FEE_PER_100K / 100_000;

// Espejo de backend/src/orders/service-fee-split.ts. El comprador, NeoPass y
// el organizador absorben un tercio cada uno: el comprador paga el cargo más
// su tercio y NeoPass se descuenta el mismo tercio (nunca menos de 0). Un
// evento al 0 % no reparte. El tercio, r × (100 + cargo) / (3 − r), va en
// centésimos de punto redondeado a la mitad hacia arriba, todo con enteros
// para no arrastrar errores de float.
export function splitServiceFee(percentage: number | string) {
  const feeBasisPoints = Math.round(Number(percentage) * 100);
  if (feeBasisPoints === 0) return { buyerPercentage: 0, neoPassPercentage: 0 };

  const numerator = MERCADO_PAGO_FEE_PER_100K * (10_000 + feeBasisPoints);
  const denominator = 300_000 - MERCADO_PAGO_FEE_PER_100K;
  const shareBasisPoints = Math.floor(
    (2 * numerator + denominator) / (2 * denominator),
  );
  return {
    buyerPercentage: (feeBasisPoints + shareBasisPoints) / 100,
    neoPassPercentage: Math.max(0, feeBasisPoints - shareBasisPoints) / 100,
  };
}
