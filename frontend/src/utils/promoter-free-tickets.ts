import { freeTicketLimitError } from './co-organizers';
import { joinNames } from './free-tickets';

// Los QR free de un RRPP en un evento: cuántos puede mandar, cuántos mandó y
// de qué tipos de entrada.
export interface PromoterFreeTickets {
  limit: number;
  sent: number;
  types: string[];
}

// Un RRPP manda QR free siempre con tope: a diferencia de un co-organizador,
// la cantidad es obligatoria.
export function promoterFreeTicketLimitError(limit: string): string | null {
  if (limit.trim() === '') return 'Indicá cuántos QR free puede mandar';
  return freeTicketLimitError(limit);
}

const ofTypes = (types: string[]) =>
  types.length > 0 ? ` · ${joinNames(types)}` : '';

// "hasta 10 QR free de General y VIP", en una invitación todavía sin aceptar.
export const freeTicketsUpTo = (limit: number, types: string[]) =>
  `hasta ${limit} QR free${types.length > 0 ? ` de ${joinNames(types)}` : ''}`;

export const promoterFreeTicketsLabel = ({
  limit,
  sent,
  types,
}: PromoterFreeTickets) => `QR free: ${sent} de ${limit}${ofTypes(types)}`;

// Lo que ve el RRPP. Si el dueño le bajó el tope por debajo de lo que ya mandó,
// le quedan 0.
export const ownFreeTicketsLabel = ({
  limit,
  sent,
  types,
}: PromoterFreeTickets) =>
  `QR free: te quedan ${Math.max(0, limit - sent)} de ${limit}${ofTypes(types)}`;
