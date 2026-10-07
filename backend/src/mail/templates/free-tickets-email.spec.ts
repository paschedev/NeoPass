import { freeTicketsEmail } from './free-tickets-email';
import { TicketForMail } from './tickets-email';

const EVENT_URL = 'https://neopass.test/eventos/evento-1';

function ticket(overrides: Partial<TicketForMail> = {}): TicketForMail {
  return {
    id: 'ticket-1',
    qrCode: 'qr-1',
    eventName: 'Fiesta Bresh',
    ticketTypeName: 'General',
    // Sunday 02:00 UTC is Saturday 23:00 in Argentina.
    eventStartDate: '2026-10-11T02:00:00.000Z',
    venueName: 'Niceto Club',
    venueAddress: 'Av. Niceto Vega 5510',
    venueCity: 'CABA',
    ...overrides,
  };
}

function build({
  tickets = [ticket()],
  name = 'Ana',
  organizerName = 'Martina',
  validUntil = null,
}: {
  tickets?: TicketForMail[];
  name?: string | null;
  organizerName?: string;
  validUntil?: string | null;
} = {}) {
  return freeTicketsEmail({
    name,
    organizerName,
    validUntil,
    tickets,
    eventUrl: EVENT_URL,
  });
}

describe('Mail de QR free', () => {
  it('el asunto dice quién manda las entradas y para qué evento', () => {
    const { subject } = build({
      tickets: [ticket(), ticket({ id: 'ticket-2' })],
    });

    expect(subject).toBe('Martina te mandó 2 entradas para Fiesta Bresh');
  });

  it('con una sola entrada el asunto va en singular', () => {
    expect(build().subject).toBe(
      'Martina te mandó una entrada para Fiesta Bresh',
    );
  });

  it('saluda por el nombre si el organizador lo cargó', () => {
    expect(build().html).toContain('¡Hola, Ana!');
  });

  it('sin nombre saluda sin dejar un espacio vacío', () => {
    const { html, text } = build({ name: null });

    expect(html).toContain('¡Hola!');
    expect(text.startsWith('¡Hola!')).toBe(true);
  });

  it('muestra la fecha, el lugar y cuántas entradas hay de cada tipo, sin imágenes', () => {
    const { html, text } = build({
      tickets: [ticket(), ticket({ id: 'ticket-2', ticketTypeName: 'VIP' })],
    });

    expect(html).toContain('Sábado 10 de octubre · 23:00 h');
    expect(html).toContain('Niceto Club');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('cid:');
    for (const body of [html, text]) {
      expect(body).toContain('1 × General');
      expect(body).toContain('1 × VIP');
    }
  });

  it('avisa que las entradas están en el PDF adjunto, una por página', () => {
    const { html, text } = build({
      tickets: [ticket(), ticket({ id: 'ticket-2' })],
    });

    for (const body of [html, text]) {
      expect(body).toContain(
        'Martina te mandó 2 entradas para Fiesta Bresh. Están en el PDF adjunto, una por página.',
      );
    }
  });

  it('con una sola entrada avisa que está en el PDF adjunto', () => {
    const { html, text } = build();

    for (const body of [html, text]) {
      expect(body).toContain(
        'Martina te mandó una entrada para Fiesta Bresh. Está en el PDF adjunto.',
      );
    }
  });

  it('con hora límite avisa hasta cuándo se puede entrar, en hora de Argentina', () => {
    // Sunday 04:00 UTC is Sunday 01:00 in Argentina.
    const { html, text } = build({
      tickets: [ticket(), ticket({ id: 'ticket-2' })],
      validUntil: '2026-10-11T04:00:00.000Z',
    });

    const notice =
      'Válidas para entrar hasta el domingo 11 de octubre a las 01:00 h.';
    expect(html).toContain(notice);
    expect(text).toContain(notice);
  });

  it('con una sola entrada el aviso de la hora límite va en singular', () => {
    const { html } = build({ validUntil: '2026-10-11T04:00:00.000Z' });

    expect(html).toContain(
      'Válida para entrar hasta el domingo 11 de octubre a las 01:00 h.',
    );
  });

  it('sin hora límite no avisa ninguna', () => {
    expect(build().html).not.toContain('para entrar hasta');
  });

  it('lleva a la página del evento y no a Mis entradas, porque no queda en ninguna cuenta', () => {
    const { html, text } = build();

    expect(html).toContain(`href="${EVENT_URL}"`);
    expect(text).toContain(EVENT_URL);
    expect(html).not.toContain('Mis entradas');
    expect(html).not.toContain('Transferir');
  });

  it('escapa el nombre del destinatario y el del organizador', () => {
    const { html } = build({
      name: '<b>Ana</b>',
      organizerName: '<i>Martina</i>',
    });

    expect(html).not.toContain('<b>Ana</b>');
    expect(html).not.toContain('<i>Martina</i>');
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;');
  });
});
