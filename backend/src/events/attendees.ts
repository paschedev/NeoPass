import { TicketStatus } from '@prisma/client';
import { ARGENTINA_TIME_ZONE } from '../common/argentina-time-zone';

// Without the holder's email: buyers haven't agreed to share it with the
// organizer's team yet (FEAT-20).
export type Attendee = {
  name: string | null;
  ticketType: string;
  batch: string | null;
  status: TicketStatus;
  checkedInAt: Date | null;
  // A free ticket ("QR free") the organizer sent, not a purchase.
  freeTicket: boolean;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  VALID: 'Válida',
  USED: 'Ingresó',
  REFUNDED: 'Devuelta',
  CANCELLED: 'Anulada',
};

// A cell starting with one of these runs as a formula in Excel or Sheets, and
// names are typed by buyers.
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

export function toCsvCell(value: string | null): string {
  let text = value ?? '';
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}

const checkInTime = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// The attendee list as a spreadsheet: a UTF-8 BOM so Excel reads the accents,
// and CRLF line breaks.
export function attendeesCsv(attendees: Attendee[]): string {
  const rows = [
    ['Nombre', 'Entrada', 'Tanda', 'Estado', 'Ingreso', 'Origen'],
    ...attendees.map((attendee) => [
      attendee.name,
      attendee.ticketType,
      attendee.batch,
      STATUS_LABEL[attendee.status],
      attendee.checkedInAt
        ? checkInTime.format(attendee.checkedInAt).replace(', ', ' ')
        : null,
      attendee.freeTicket ? 'QR free' : 'Compra',
    ]),
  ];
  return `\uFEFF${rows.map((row) => row.map(toCsvCell).join(',')).join('\r\n')}`;
}

// The CSV leaves NeoPass for good, so the owner sees who downloaded it.
export const exportActivitySummary = (tickets: number) =>
  `Descargó la lista del público (${tickets} ${tickets === 1 ? 'entrada' : 'entradas'}).`;

// Door check-in: used tickets over the tickets that can still get in (valid or
// used; refunded and cancelled ones don't count), overall and per ticket type.
export function summarizeCheckIns(
  ticketTypes: { id: string; name: string; batch: { name: string } | null }[],
  counts: { ticketTypeId: string; status: TicketStatus; count: number }[],
) {
  const count = (ticketTypeId: string, status: TicketStatus) =>
    counts.find(
      (row) => row.ticketTypeId === ticketTypeId && row.status === status,
    )?.count ?? 0;
  const byTicketType = ticketTypes.map(({ id, name, batch }) => {
    const checkedIn = count(id, 'USED');
    return {
      name,
      batch: batch?.name ?? null,
      checkedIn,
      total: checkedIn + count(id, 'VALID'),
    };
  });
  return {
    checkedIn: byTicketType.reduce((sum, type) => sum + type.checkedIn, 0),
    total: byTicketType.reduce((sum, type) => sum + type.total, 0),
    byTicketType,
  };
}
