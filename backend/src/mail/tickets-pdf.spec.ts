import * as qrcode from 'qrcode';
import { TicketForMail } from './templates/tickets-email';
import {
  qrRuns,
  renderTicketsPdf,
  ticketPdfPages,
  ticketsPdfFilename,
} from './tickets-pdf';

function ticket(overrides: Partial<TicketForMail> = {}): TicketForMail {
  return {
    id: '1a2b3c4d-0000-4000-8000-000000000001',
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

function tickets(count: number): TicketForMail[] {
  return Array.from({ length: count }, (_, i) =>
    ticket({
      id: `0000000${i}-0000-4000-8000-000000000000`,
      qrCode: `qr-${i}`,
    }),
  );
}

function countMatches(pdf: Buffer, pattern: RegExp): number {
  return pdf.toString('latin1').match(pattern)?.length ?? 0;
}

describe('PDF de entradas', () => {
  describe('páginas', () => {
    it('una página por entrada, numeradas "Entrada N de M"', () => {
      const pages = ticketPdfPages({ tickets: tickets(3), validUntil: null });

      expect(pages.map((page) => page.position)).toEqual([
        'Entrada 1 de 3',
        'Entrada 2 de 3',
        'Entrada 3 de 3',
      ]);
    });

    it('cada página lleva el QR de su entrada, el tipo y un código corto para soporte', () => {
      const [page] = ticketPdfPages({
        tickets: [ticket({ qrCode: 'qr-secreto', ticketTypeName: 'VIP' })],
        validUntil: null,
      });

      expect(page.qrCode).toBe('qr-secreto');
      expect(page.ticketTypeName).toBe('VIP');
      expect(page.code).toBe('1A2B3C4D');
    });

    it('lleva el evento con la fecha en hora de Argentina y el lugar', () => {
      const [page] = ticketPdfPages({ tickets: [ticket()], validUntil: null });

      expect(page.eventName).toBe('Fiesta Bresh');
      expect(page.details).toEqual([
        'Sábado 10 de octubre · 23:00 h',
        'Niceto Club · Av. Niceto Vega 5510, CABA',
      ]);
    });

    it('en QR free cada página dice hasta qué hora vale', () => {
      // Sunday 04:00 UTC is Sunday 01:00 in Argentina.
      const pages = ticketPdfPages({
        tickets: tickets(2),
        validUntil: '2026-10-11T04:00:00.000Z',
      });

      for (const page of pages) {
        expect(page.deadline).toBe(
          'Válida para entrar hasta el domingo 11 de octubre a las 01:00 h',
        );
      }
    });

    it('sin hora límite no dice ninguna', () => {
      const [page] = ticketPdfPages({ tickets: [ticket()], validUntil: null });

      expect(page.deadline).toBeNull();
    });

    it('omite lo que el PDF no puede dibujar (emojis, otros alfabetos) y conserva acentos, ñ y signos', () => {
      const [page] = ticketPdfPages({
        tickets: [
          ticket({
            eventName: 'Fiesta 🔥 Bresh — ñandú ¿qué? 漢字',
            ticketTypeName: '✨ VIP “Gold”',
            venueName: 'Club 🎉',
          }),
        ],
        validUntil: null,
      });

      expect(page.eventName).toBe('Fiesta Bresh — ñandú ¿qué?');
      expect(page.ticketTypeName).toBe('VIP “Gold”');
      expect(page.details[1]).toBe('Club · Av. Niceto Vega 5510, CABA');
    });

    it('una entrada encolada antes de que el mail llevara fecha y lugar se arma igual', () => {
      const [page] = ticketPdfPages({
        tickets: [
          {
            id: '1a2b3c4d-0000-4000-8000-000000000001',
            qrCode: 'qr-1',
            eventName: 'Fiesta Bresh',
            ticketTypeName: 'General',
          },
        ],
        validUntil: null,
      });

      expect(page.details).toEqual([]);
    });
  });

  describe('QR', () => {
    // qrcode's own SVG is the reference: its path draws each row's dark
    // modules as horizontal lines ("M col row+0.5", "m skip 0", "h length").
    async function referenceModules(text: string): Promise<Set<string>> {
      const svg = await qrcode.toString(text, {
        type: 'svg',
        margin: 0,
        errorCorrectionLevel: 'M',
      });
      const path = /<path stroke="[^"]*" d="([^"]+)"/.exec(svg)?.[1] ?? '';
      const dark = new Set<string>();
      let col = 0;
      let row = 0;
      for (const [, command, a, b] of path.matchAll(
        /([Mmh])([\d.]+)(?: ([\d.]+))?/g,
      )) {
        if (command === 'M') {
          col = Number(a);
          row = Number(b) - 0.5;
        } else if (command === 'm') {
          col += Number(a);
        } else {
          for (let i = 0; i < Number(a); i++) dark.add(`${row},${col + i}`);
          col += Number(a);
        }
      }
      return dark;
    }

    it('dibuja el mismo QR que la librería, módulo por módulo (sin espejar ni rotar)', async () => {
      const text = '5f0c2a8e-3b1d-4c7a-9e6f-2d8b1a4c7e90';
      const { runs } = qrRuns(text);
      const drawn = new Set(
        runs.flatMap((run) =>
          Array.from(
            { length: run.length },
            (_, i) => `${run.row},${run.col + i}`,
          ),
        ),
      );

      expect(drawn).toEqual(await referenceModules(text));
    });
  });

  describe('archivo', () => {
    it.each([1, 3, 10])(
      'con %i entradas arma un PDF con una página por entrada',
      async (count) => {
        const pdf = await renderTicketsPdf(
          ticketPdfPages({ tickets: tickets(count), validUntil: null }),
        );

        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(countMatches(pdf, /\/Type \/Page\b/g)).toBe(count);
      },
    );

    it('textos largos no agregan páginas de más', async () => {
      const long = 'Muy largo '.repeat(60);
      const pdf = await renderTicketsPdf(
        ticketPdfPages({
          tickets: [
            ticket({
              eventName: long,
              ticketTypeName: long,
              venueName: long,
              venueAddress: long,
            }),
          ],
          validUntil: '2026-10-11T04:00:00.000Z',
        }),
      );

      expect(countMatches(pdf, /\/Type \/Page\b/g)).toBe(1);
    });

    it.each([
      [
        'Fiesta Ñandú: ¡Edición 2026!',
        3,
        'entradas-fiesta-nandu-edicion-2026.pdf',
      ],
      ['Fiesta Bresh', 1, 'entrada-fiesta-bresh.pdf'],
      ['🔥🔥', 2, 'entradas.pdf'],
    ])('"%s" con %i entradas se llama %s', (eventName, count, filename) => {
      expect(ticketsPdfFilename(eventName, count)).toBe(filename);
    });
  });
});
