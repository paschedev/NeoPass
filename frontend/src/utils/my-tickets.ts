import { isVoidTicket, type MyTicket } from '@/components/tickets/types';
import { getEventPhase } from './event-edit';

export type TicketBadge = 'VALID' | 'EXPIRED' | 'USED' | 'VOID';

// Vigente: no está anulada y su evento todavía no terminó (por fecha o por
// estado). Una entrada usada sigue vigente mientras el evento está en curso.
function isCurrent(ticket: MyTicket, now: Date) {
  return (
    !isVoidTicket(ticket.status) &&
    getEventPhase(ticket.ticketType.event, now) !== 'CLOSED'
  );
}

const startTime = (ticket: MyTicket) =>
  new Date(ticket.ticketType.event.startDate).getTime();

// Vigentes de la más próxima a la más lejana; el historial, de la más
// reciente a la más vieja.
export function splitTickets(tickets: MyTicket[], now: Date) {
  return {
    current: tickets
      .filter((ticket) => isCurrent(ticket, now))
      .sort((a, b) => startTime(a) - startTime(b)),
    history: tickets
      .filter((ticket) => !isCurrent(ticket, now))
      .sort((a, b) => startTime(b) - startTime(a)),
  };
}

// Una entrada sin usar de un evento que ya terminó deja de ser válida.
export function ticketBadge(ticket: MyTicket, now: Date): TicketBadge {
  if (isVoidTicket(ticket.status)) return 'VOID';
  if (ticket.status === 'USED') return 'USED';
  return getEventPhase(ticket.ticketType.event, now) === 'CLOSED'
    ? 'EXPIRED'
    : 'VALID';
}
