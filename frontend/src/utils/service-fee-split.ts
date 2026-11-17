// Mercado Pago le cobra al organizador su comisión sobre todo el pago. Se toma
// la tasa más alta (el dinero disponible al instante): 6,6 % + 21 % de IVA =
// 7,986 %, expresada sobre 100.000 para operar con enteros.
const MERCADO_PAGO_FEE_PER_100K = 7986;

export const MERCADO_PAGO_FEE_RATE = MERCADO_PAGO_FEE_PER_100K / 100_000;

// Espejo de backend/src/orders/service-fee-split.ts. El comprador y el
// organizador absorben la mitad cada uno y NeoPass se queda con el cargo
// completo: el comprador paga el cargo más su mitad. Un evento al 0 % también
// reparte: el comprador paga solo su mitad. La mitad, r × (100 + cargo) /
// (2 − r), va en centésimos de punto redondeado a la mitad hacia arriba, todo
// con enteros para no arrastrar errores de float.
export function splitServiceFee(percentage: number | string) {
  const feeBasisPoints = Math.round(Number(percentage) * 100);
  const numerator = MERCADO_PAGO_FEE_PER_100K * (10_000 + feeBasisPoints);
  const denominator = 200_000 - MERCADO_PAGO_FEE_PER_100K;
  const halfBasisPoints = Math.floor(
    (2 * numerator + denominator) / (2 * denominator),
  );
  return {
    buyerPercentage: (feeBasisPoints + halfBasisPoints) / 100,
    neoPassPercentage: feeBasisPoints / 100,
  };
}
