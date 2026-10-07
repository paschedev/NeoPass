import { TicketForMail, ticketsEmail } from './tickets-email';

const TICKETS_URL = 'https://neopass.test/panel/tickets';

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

function build(tickets: TicketForMail[], name = 'Ana') {
  return ticketsEmail({ name, tickets, ticketsUrl: TICKETS_URL });
}

describe('Mail de entradas', () => {
  it('el asunto nombra el evento', () => {
    const { subject } = build([ticket(), ticket({ id: 'ticket-2' })]);

    expect(subject).toBe('Tus entradas para Fiesta Bresh');
  });

  it('con una sola entrada el asunto va en singular', () => {
    expect(build([ticket()]).subject).toBe('Tu entrada para Fiesta Bresh');
  });

  it('muestra la fecha y la hora del evento en hora de Argentina', () => {
    expect(build([ticket()]).html).toContain('Sábado 10 de octubre · 23:00 h');
  });

  it('muestra el lugar y la dirección del evento', () => {
    const { html } = build([ticket()]);

    expect(html).toContain('Niceto Club');
    expect(html).toContain('Av. Niceto Vega 5510, CABA');
  });

  it('si el evento no tiene lugar cargado, no deja una línea vacía', () => {
    const { html } = build([
      ticket({ venueName: null, venueAddress: null, venueCity: null }),
    ]);

    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
    expect(html).not.toContain('null');
  });

  it('no lleva imágenes: avisa que las entradas están en el PDF adjunto, una por página', () => {
    const { html, text } = build([
      ticket({ id: 'ticket-1' }),
      ticket({ id: 'ticket-2' }),
    ]);

    expect(html).not.toContain('<img');
    expect(html).not.toContain('cid:');
    for (const body of [html, text]) {
      expect(body).toContain(
        'Tus entradas están en el PDF adjunto, una por página.',
      );
    }
  });

  it('con una sola entrada avisa que está en el PDF adjunto', () => {
    const { html, text } = build([ticket()]);

    for (const body of [html, text]) {
      expect(body).toContain('Tu entrada está en el PDF adjunto.');
    }
  });

  it('lista cuántas entradas hay de cada tipo', () => {
    const { html, text } = build([
      ticket({ id: 'ticket-1', ticketTypeName: 'General' }),
      ticket({ id: 'ticket-2', ticketTypeName: 'VIP' }),
      ticket({ id: 'ticket-3', ticketTypeName: 'General' }),
    ]);

    for (const body of [html, text]) {
      expect(body).toContain('2 × General');
      expect(body).toContain('1 × VIP');
    }
  });

  it('el botón lleva a Mis entradas', () => {
    const { html } = build([ticket()]);

    expect(html).toContain(`href="${TICKETS_URL}"`);
    expect(html).toContain('Ver mis entradas');
  });

  it('escapa los textos que cargan el organizador y el comprador', () => {
    const { html } = build(
      [
        ticket({
          eventName: '<script>alert(1)</script>',
          ticketTypeName: 'VIP & Co',
          venueName: '<b>Club</b>',
          venueAddress: '"Calle" 1',
          venueCity: "O'Higgins",
        }),
      ],
      'Ana <b>',
    );

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('VIP &amp; Co');
    expect(html).toContain('&lt;b&gt;Club&lt;/b&gt;');
    expect(html).toContain('&quot;Calle&quot; 1, O&#39;Higgins');
    expect(html).toContain('Ana &lt;b&gt;');
  });

  it('una entrada encolada antes del cambio, sin fecha ni lugar, se arma igual', () => {
    const { subject, html, text } = build([
      {
        id: 'ticket-1',
        qrCode: 'qr-1',
        eventName: 'Fiesta Bresh',
        ticketTypeName: 'General',
      },
    ]);

    expect(subject).toBe('Tu entrada para Fiesta Bresh');
    for (const body of [html, text]) {
      expect(body).toContain('Fiesta Bresh');
      expect(body).not.toContain('undefined');
      expect(body).not.toContain('null');
      expect(body).not.toContain('Invalid Date');
    }
  });

  it('la versión en texto plano trae el evento, la fecha, el lugar y el enlace a Mis entradas', () => {
    const { text } = build([ticket()]);

    expect(text).toContain('Fiesta Bresh');
    expect(text).toContain('Sábado 10 de octubre · 23:00 h');
    expect(text).toContain('Niceto Club · Av. Niceto Vega 5510, CABA');
    expect(text).toContain(TICKETS_URL);
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('lleva el encabezado de la marca y el contacto de soporte', () => {
    const { html, text } = build([ticket()]);

    expect(html).toContain('NeoPass');
    expect(html).toContain('mailto:soporte@neopass.ar');
    expect(text).toContain('soporte@neopass.ar');
  });
});
