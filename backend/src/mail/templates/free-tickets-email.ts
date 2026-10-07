import { escapeHtml } from '../escape-html';
import { button, layout, STYLES, TEXT_FOOTER } from './layout';
import {
  argentinaDateParts,
  eventDetailLines,
  eventHeaderHtml,
  TicketForMail,
  ticketSummaryHtml,
  ticketSummaryLines,
} from './tickets-email';

// "el domingo 11 de octubre a las 01:00 h", in Argentina's time zone.
export function formatEntryDeadline(isoDate: string): string {
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
      ? 'Está en el PDF adjunto. Mostrá el QR en la puerta, desde el celular o impreso: sirve para una sola persona.'
      : 'Están en el PDF adjunto, una por página. Mostrá cada QR en la puerta, desde el celular o impreso: cada uno sirve para una sola persona.'
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
      ${ticketSummaryHtml(tickets)}
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
      ...ticketSummaryLines(tickets),
    ].join('\n'),
    `El evento:\n${eventUrl}`,
    warning,
    TEXT_FOOTER,
  ].join('\n\n');

  return {
    subject: `${organizerName} te mandó ${what} para ${event.eventName}`,
    html,
    text,
  };
}
