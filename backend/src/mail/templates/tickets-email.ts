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

// The QR goes as an inline image (CID): Gmail blocks `data:` images.
export function qrContentId(ticketId: string): string {
  return `qr-${ticketId}`;
}

function formatEventDate(isoDate?: string): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;

  const parts: Record<string, string> = {};
  for (const { type, value } of eventDateFormat.formatToParts(date)) {
    parts[type] = value;
  }
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
  const eventDetails = event
    ? [formatEventDate(event.eventStartDate), formatVenue(event)].filter(
        (line): line is string => line !== null,
      )
    : [];
  const intro = single
    ? 'Acá está tu entrada. Mostrá el QR en la puerta: sirve para una sola persona.'
    : 'Acá están tus entradas. Mostrá cada QR en la puerta: cada uno sirve para una sola persona.';
  const warning =
    'No compartas los códigos: quien tenga el QR entra con tu entrada. Para pasarle una entrada a alguien, usá "Transferir" en Mis entradas.';

  const eventHtml = event
    ? `<h2 style="margin: 0 0 4px; font-size: 18px; line-height: 24px; color: #18181b;">${escapeHtml(event.eventName)}</h2>
      ${eventDetails
        .map(
          (line) =>
            `<p style="margin: 0; font-size: 14px; line-height: 20px; color: #52525b;">${escapeHtml(line)}</p>`,
        )
        .join('')}`
    : '';
  const ticketsHtml = tickets
    .map(
      (ticket) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 16px 0 0; border: 1px solid #e4e4e7; border-radius: 12px;">
        <tr>
          <td align="center" style="padding: 20px;">
            <p style="margin: 0 0 12px; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; color: #52525b;">${escapeHtml(ticket.ticketTypeName)}</p>
            <img src="cid:${qrContentId(ticket.id)}" alt="Código QR de tu entrada" width="220" height="220" style="display: block; margin: 0 auto;">
          </td>
        </tr>
      </table>`,
    )
    .join('');

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
            ...tickets.map((ticket) => `- ${ticket.ticketTypeName}`),
          ].join('\n'),
        ]
      : []),
    `Los códigos QR están en la versión con imágenes de este mail y en Mis entradas:\n${ticketsUrl}`,
    warning,
    TEXT_FOOTER,
  ].join('\n\n');

  return { subject, html, text };
}
