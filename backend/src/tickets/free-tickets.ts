export const MAX_FREE_TICKETS_PER_GRANT = 10;

// Free tickets are mailed from our domain to any address the organizer types:
// these limits keep it from being used to send spam.
export const MAX_FREE_TICKET_GRANTS_PER_HOUR = 30;
export const FREE_TICKETS_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

// The entry deadline has to fall within the event and still be ahead.
export function validUntilError(
  validUntil: Date,
  event: { startDate: Date; endDate: Date },
  now: Date,
): string | null {
  if (validUntil <= event.startDate || validUntil > event.endDate) {
    return 'La hora límite tiene que estar entre el inicio y el fin del evento';
  }
  if (validUntil <= now) return 'La hora límite ya pasó';
  return null;
}

type GrantRow = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  validUntil: Date | null;
  createdAt: Date;
  lastSentAt: Date;
  cancelledAt: Date | null;
  ticketType: { id: string; name: string };
  tickets: { status: string }[];
};

// What the organizer sees of a grant: never the QR codes.
export function toGrantResponse({ tickets, cancelledAt, ...grant }: GrantRow) {
  return {
    ...grant,
    quantity: tickets.length,
    checkedIn: tickets.filter((ticket) => ticket.status === 'USED').length,
    status: cancelledAt ? ('CANCELLED' as const) : ('ACTIVE' as const),
  };
}
