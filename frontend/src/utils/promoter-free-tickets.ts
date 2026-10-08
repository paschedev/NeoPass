import { freeTicketLimitError } from './co-organizers';

// Los QR free de un RPP en un evento: cuántos puede mandar y cuántos mandó.
export interface PromoterFreeTickets {
  limit: number;
  sent: number;
}

// Un RPP manda QR free siempre con tope: a diferencia de un co-organizador,
// la cantidad es obligatoria.
export function promoterFreeTicketLimitError(limit: string): string | null {
  if (limit.trim() === '') return 'Indicá cuántos QR free puede mandar';
  return freeTicketLimitError(limit);
}

export const promoterFreeTicketsLabel = ({
  limit,
  sent,
}: PromoterFreeTickets) => `QR free: ${sent} de ${limit}`;
