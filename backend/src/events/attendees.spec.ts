import {
  attendeesCsv,
  exportActivitySummary,
  summarizeCheckIns,
  toCsvCell,
} from './attendees';

describe('toCsvCell', () => {
  it('entrecomilla y duplica las comillas', () => {
    expect(toCsvCell('Ana "la jefa"')).toBe('"Ana ""la jefa"""');
  });

  it.each(['=1+1', '+54 11', '-2', '@cmd', '\tx'])(
    'neutraliza lo que una planilla tomaría como fórmula: %s',
    (value) => {
      expect(toCsvCell(value)).toBe(`"'${value}"`);
    },
  );

  it('una celda vacía queda vacía', () => {
    expect(toCsvCell(null)).toBe('""');
  });
});

describe('attendeesCsv', () => {
  it('arma el CSV con encabezado, estados en español y la hora de ingreso en Argentina, sin emails', () => {
    const csv = attendeesCsv([
      {
        name: 'Ana',
        ticketType: 'General',
        batch: 'Preventa',
        status: 'USED',
        checkedInAt: new Date('2026-10-10T02:30:00.000Z'),
        freeTicket: false,
      },
      {
        name: null,
        ticketType: 'Campo',
        batch: null,
        status: 'CANCELLED',
        checkedInAt: null,
        freeTicket: true,
      },
    ]);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual([
      '"Nombre","Entrada","Tanda","Estado","Ingreso","Origen"',
      '"Ana","General","Preventa","Ingresó","9/10/2026 23:30","Compra"',
      '"","Campo","","Anulada","","QR free"',
    ]);
  });
});

describe('exportActivitySummary', () => {
  it('cuenta las entradas de la lista descargada, en singular si es una', () => {
    expect(exportActivitySummary(12)).toBe(
      'Descargó la lista del público (12 entradas).',
    );
    expect(exportActivitySummary(1)).toBe(
      'Descargó la lista del público (1 entrada).',
    );
  });
});

describe('summarizeCheckIns', () => {
  it('cuenta los ingresos sobre las entradas válidas o usadas, en total y por tipo', () => {
    const summary = summarizeCheckIns(
      [
        { id: 't1', name: 'General', batch: { name: 'Preventa' } },
        { id: 't2', name: 'Campo', batch: null },
      ],
      [
        { ticketTypeId: 't1', status: 'USED', count: 3 },
        { ticketTypeId: 't1', status: 'VALID', count: 2 },
        { ticketTypeId: 't1', status: 'REFUNDED', count: 4 },
        { ticketTypeId: 't2', status: 'VALID', count: 1 },
      ],
    );

    expect(summary).toEqual({
      checkedIn: 3,
      total: 6,
      byTicketType: [
        { name: 'General', batch: 'Preventa', checkedIn: 3, total: 5 },
        { name: 'Campo', batch: null, checkedIn: 0, total: 1 },
      ],
    });
  });
});
