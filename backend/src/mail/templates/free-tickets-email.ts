import { escapeHtml } from '../escape-html';
import { button, layout, STYLES, TEXT_FOOTER } from './layout';
import {
  argentinaDateParts,
  eventDetailLines,
  eventHeaderHtml,
  ticketCardsHtml,
  TicketForMail,
} from './tickets-email';

// "el domingo 11 de octubre a las 01:00 h", in Argentina's time zone.
function formatEntryDeadline(isoDate: string): string {
  const parts = argentinaDateParts(new Date(isoDate));
  return `el ${parts.weekday} ${parts.day} de ${parts.month} a las ${parts.hour}:${parts.minute} h`;
}

// Free tickets go only to the email: they are not in any account, so the mail
// links to the event and not to "Mis entradas". All of them are for one event.
export function freeTicketsEmail({
  name,
  organizerName,
  validUntil,
  tickets,
  eventUrl,
}: {
  name: string | null;
  organizerName: string;
  validUntil: string | null;
  tickets: TicketForMail[];
  eventUrl: string;
}): { subject: string; html: string; text: string } {
  const single = tickets.length === 1;
  const event = tickets[0];
  const what = single ? 'una entrada' : `${tickets.length} entradas`;
  const greeting = name ? `¡Hola, ${name}!` : '¡Hola!';
  const intro = `${organizerName} te mandó ${what} para ${event.eventName}. ${
    single
      ? 'Mostrá el QR en la puerta: sirve para una sola persona.'
      : 'Mostrá cada QR en la puerta: cada uno sirve para una sola persona.'
  }`;
  const deadline = validUntil
    ? `${single ? 'Válida' : 'Válidas'} para entrar hasta ${formatEntryDeadline(validUntil)}.`
    : null;
  const warning =
    'No compartas los códigos: quien tenga el QR entra con esa entrada.';

  const html = layout({
    preheader: escapeHtml(intro),
    content: `
      <h1 style="${STYLES.title}">${escapeHtml(greeting)}</h1>
      <p style="${STYLES.paragraph}">${escapeHtml(intro)}</p>
      ${deadline ? `<p style="${STYLES.paragraph}"><strong>${escapeHtml(deadline)}</strong></p>` : ''}
      ${eventHeaderHtml(event)}
      ${ticketCardsHtml(tickets)}
      ${button('Ver el evento', eventUrl)}
      <p style="${STYLES.note}">${escapeHtml(warning)}</p>`,
  });

  const text = [
    greeting,
    intro,
    ...(deadline ? [deadline] : []),
    [
      event.eventName,
      ...eventDetailLines(event),
      ...tickets.map((ticket) => `- ${ticket.ticketTypeName}`),
    ].join('\n'),
    `Los códigos QR están en la versión con imágenes de este mail. El evento:\n${eventUrl}`,
    warning,
    TEXT_FOOTER,
  ].join('\n\n');

  return {
    subject: `${organizerName} te mandó ${what} para ${event.eventName}`,
    html,
    text,
  };
}
