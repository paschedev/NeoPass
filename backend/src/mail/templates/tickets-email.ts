import { ARGENTINA_TIME_ZONE } from '../../common/argentina-time-zone';
import { escapeHtml } from '../escape-html';
import { button, layout, STYLES, TEXT_FOOTER } from './layout';

export interface TicketForMail {
  id: string;
  qrCode: string;
  eventName: string;
  ticketTypeName: string;
  // Optional: jobs queued before these fields existed do not carry them.
  eventStartDate?: string;
  venueName?: string | null;
  venueAddress?: string | null;
  venueCity?: string | null;
}

const eventDateFormat = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// Weekday, day, month, hour and minute of a date in Argentina's time zone.
export function argentinaDateParts(date: Date): Record<string, string> {
  const parts: Record<string, string> = {};
  for (const { type, value } of eventDateFormat.formatToParts(date)) {
    parts[type] = value;
  }
  return parts;
}

function formatEventDate(isoDate?: string): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const parts = argentinaDateParts(date);
  const weekday =
    parts.weekday.charAt(0).toUpperCase() + parts.weekday.slice(1);
  return `${weekday} ${parts.day} de ${parts.month} · ${parts.hour}:${parts.minute} h`;
}

function formatVenue(ticket: TicketForMail): string | null {
  const address = [ticket.venueAddress, ticket.venueCity]
    .filter(Boolean)
    .join(', ');
  return [ticket.venueName, address].filter(Boolean).join(' · ') || null;
}

// Date and place of the event, one line for each one that is known.
export function eventDetailLines(event: TicketForMail): string[] {
  return [formatEventDate(event.eventStartDate), formatVenue(event)].filter(
    (line): line is string => line !== null,
  );
}

export function eventHeaderHtml(event: TicketForMail): string {
  return `<h2 style="margin: 0 0 4px; font-size: 18px; line-height: 24px; color: #18181b;">${escapeHtml(event.eventName)}</h2>
      ${eventDetailLines(event)
        .map(
          (line) =>
            `<p style="margin: 0; font-size: 14px; line-height: 20px; color: #52525b;">${escapeHtml(line)}</p>`,
        )
        .join('')}`;
}

// "2 × General", one line per ticket type, in the order they come.
export function ticketSummaryLines(tickets: TicketForMail[]): string[] {
  const counts = new Map<string, number>();
  for (const { ticketTypeName } of tickets) {
    counts.set(ticketTypeName, (counts.get(ticketTypeName) ?? 0) + 1);
  }
  return [...counts].map(([name, count]) => `${count} × ${name}`);
}

// The QRs travel in the PDF attachment: a body with several QR images lands in
// Gmail's Promotions tab, so the mail only lists the tickets.
export function ticketSummaryHtml(tickets: TicketForMail[]): string {
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0 0; border: 1px solid #e4e4e7; border-radius: 12px;">
        <tr>
          <td style="padding: 16px 20px;">
            ${ticketSummaryLines(tickets)
              .map(
                (line) =>
                  `<p style="margin: 0; font-size: 15px; line-height: 24px; font-weight: 600; color: #18181b;">${escapeHtml(line)}</p>`,
              )
              .join('')}
          </td>
        </tr>
      </table>`;
}

// One order has tickets of a single event, so the event comes from the first.
export function ticketsEmail({
  name,
  tickets,
  ticketsUrl,
}: {
  name: string;
  tickets: TicketForMail[];
  ticketsUrl: string;
}): { subject: string; html: string; text: string } {
  const single = tickets.length === 1;
  const event = tickets.length > 0 ? tickets[0] : undefined;
  const eventDetails = event ? eventDetailLines(event) : [];
  const intro = single
    ? 'Tu entrada está en el PDF adjunto. Mostrá el QR en la puerta, desde el celular o impreso: sirve para una sola persona.'
    : 'Tus entradas están en el PDF adjunto, una por página. Mostrá cada QR en la puerta, desde el celular o impreso: cada uno sirve para una sola persona.';
  const warning =
    'No compartas los códigos: quien tenga el QR entra con tu entrada. Para pasarle una entrada a alguien, usá "Transferir" en Mis entradas.';

  const eventHtml = event ? eventHeaderHtml(event) : '';
  const ticketsHtml = tickets.length > 0 ? ticketSummaryHtml(tickets) : '';

  const subject = event
    ? `${single ? 'Tu entrada' : 'Tus entradas'} para ${event.eventName}`
    : 'Tus entradas están listas';

  const html = layout({
    preheader: escapeHtml(intro),
    content: `
      <h1 style="${STYLES.title}">¡Hola, ${escapeHtml(name)}!</h1>
      <p style="${STYLES.paragraph}">${escapeHtml(intro)}</p>
      ${eventHtml}
      ${ticketsHtml}
      ${button('Ver mis entradas', ticketsUrl)}
      <p style="${STYLES.note}">${escapeHtml(warning)}</p>`,
  });

  const text = [
    `¡Hola, ${name}!`,
    intro,
    ...(event
      ? [
          [
            event.eventName,
            ...eventDetails,
            ...ticketSummaryLines(tickets),
          ].join('\n'),
        ]
      : []),
    `También las tenés en Mis entradas:\n${ticketsUrl}`,
    warning,
    TEXT_FOOTER,
  ].join('\n\n');

  return { subject, html, text };
}
