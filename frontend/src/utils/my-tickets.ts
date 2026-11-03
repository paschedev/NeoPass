import { isVoidTicket, type MyTicket } from '@/components/tickets/types';
import { getEventPhase } from './event-edit';

export type TicketBadge = 'VALID' | 'EXPIRED' | 'USED' | 'VOID' | 'DELETED';

// Vigente: no está anulada y su evento todavía no terminó (por fecha o por
// estado). Una entrada usada sigue vigente mientras el evento está en curso, y
// la de un evento eliminado, hasta su fecha, para que se vea el aviso.
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

// Título del aviso de Mis entradas mientras el correo no está confirmado.
export function lockedTicketsTitle(count: number) {
  if (count === 0) return 'Confirmá tu correo';
  return count === 1
    ? 'Tenés 1 entrada de regalo bloqueada'
    : `Tenés ${count} entradas de regalo bloqueadas`;
}

// Una entrada sin usar de un evento que ya terminó deja de ser válida.
export function ticketBadge(ticket: MyTicket, now: Date): TicketBadge {
  if (isVoidTicket(ticket.status)) return 'VOID';
  if (ticket.ticketType.event.deletion) return 'DELETED';
  if (ticket.status === 'USED') return 'USED';
  return getEventPhase(ticket.ticketType.event, now) === 'CLOSED'
    ? 'EXPIRED'
    : 'VALID';
}
