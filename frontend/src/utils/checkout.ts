// Mismo tope que valida el backend (CreateOrderDto).
export const MAX_TICKETS_PER_ORDER = 10;

export type Cart = Record<string, number>;

interface PricedTicketType {
  id: string;
  price: number | string;
}

const toCents = (amount: number | string) => Math.round(Number(amount) * 100);

const countTickets = (cart: Cart) =>
  Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);

// Desglose que ve el comprador antes de pagar. El cargo se calcula como en
// el backend: subtotal × % del evento, redondeado a centavos (mitad hacia
// arriba). Todo en centavos enteros para no arrastrar errores de float.
export function calculateCheckoutTotals(
  ticketTypes: PricedTicketType[],
  cart: Cart,
  feePercentage: number | string,
) {
  const subtotalCents = ticketTypes.reduce(
    (sum, type) => sum + (cart[type.id] ?? 0) * toCents(type.price),
    0,
  );
  const feeBasisPoints = Math.round(Number(feePercentage) * 100);
  const feeCents = Math.round((subtotalCents * feeBasisPoints) / 10_000);
  return {
    tickets: countTickets(cart),
    subtotal: subtotalCents / 100,
    serviceFee: feeCents / 100,
    total: (subtotalCents + feeCents) / 100,
  };
}

// Cambia la cantidad de un tipo sin bajar de 0, sin pasar de lo disponible
// y sin superar el máximo por orden. Si no se puede, devuelve el mismo carrito.
export function updateCart(
  cart: Cart,
  ticketTypeId: string,
  delta: number,
  available: number,
): Cart {
  const next = (cart[ticketTypeId] ?? 0) + delta;
  if (next < 0 || next > available) return cart;
  if (countTickets(cart) + delta > MAX_TICKETS_PER_ORDER) return cart;

  const updated = { ...cart };
  if (next === 0) delete updated[ticketTypeId];
  else updated[ticketTypeId] = next;
  return updated;
}
