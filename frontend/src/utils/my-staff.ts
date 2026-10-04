// El link de venta de un RPP para un evento: la compra hecha desde ahí le
// suma la comisión.
export function rppLink(origin: string, eventId: string, staffId: string) {
  return `${origin}/eventos/${eventId}?rpp=${staffId}`;
}
