import { describe, expect, it } from 'vitest';
import type { MyTicket } from '@/components/tickets/types';
import { splitTickets, ticketBadge } from './my-tickets';

const NOW = new Date('2026-10-10T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetHours: number) =>
  new Date(NOW.getTime() + offsetHours * HOUR).toISOString();

function ticket(
  id: string,
  {
    status = 'VALID',
    eventStatus = 'PUBLISHED',
    start = 24,
    end = 30,
    deleted = false,
  }: {
    status?: string;
    eventStatus?: string;
    start?: number;
    end?: number;
    deleted?: boolean;
  } = {},
): MyTicket {
  return {
    id,
    status,
    qrCode: `qr-${id}`,
    ticketType: {
      name: 'General',
      event: {
        title: `Evento ${id}`,
        startDate: at(start),
        endDate: at(end),
        status: eventStatus,
        venueName: null,
        deletion: deleted
          ? {
              byNeoPass: false,
              organizerName: 'Productora',
              contactEmail: 'org@neopass.test',
            }
          : null,
      },
    },
  };
}

const ids = (tickets: MyTicket[]) => tickets.map((t) => t.id);

describe('splitTickets', () => {
  it('una entrada válida de un evento que no terminó está vigente', () => {
    const { current, history } = splitTickets([ticket('a')], NOW);

    expect(ids(current)).toEqual(['a']);
    expect(history).toEqual([]);
  });

  it('una entrada usada con el evento en curso sigue vigente', () => {
    const { current } = splitTickets(
      [ticket('a', { status: 'USED', start: -2, end: 4 })],
      NOW,
    );

    expect(ids(current)).toEqual(['a']);
  });

  it('la entrada de un evento cuyo fin ya pasó va al historial aunque no esté marcado como finalizado', () => {
    const { current, history } = splitTickets(
      [ticket('a', { start: -8, end: -1 })],
      NOW,
    );

    expect(current).toEqual([]);
    expect(ids(history)).toEqual(['a']);
  });

  it.each(['FINISHED', 'CANCELLED'])(
    'la entrada de un evento %s va al historial',
    (eventStatus) => {
      const { history } = splitTickets([ticket('a', { eventStatus })], NOW);

      expect(ids(history)).toEqual(['a']);
    },
  );

  it.each(['REFUNDED', 'CANCELLED'])(
    'una entrada %s va al historial aunque el evento no haya terminado',
    (status) => {
      const { history } = splitTickets([ticket('a', { status })], NOW);

      expect(ids(history)).toEqual(['a']);
    },
  );

  it('la entrada de un evento eliminado sigue entre las vigentes hasta su fecha, para que se vea el aviso', () => {
    const { current, history } = splitTickets(
      [
        ticket('futuro', { deleted: true }),
        ticket('pasado', { deleted: true, start: -8, end: -1 }),
      ],
      NOW,
    );

    expect(ids(current)).toEqual(['futuro']);
    expect(ids(history)).toEqual(['pasado']);
  });

  it('las vigentes van de la más próxima a la más lejana y el historial de la más reciente a la más vieja', () => {
    const { current, history } = splitTickets(
      [
        ticket('lejana', { start: 48, end: 54 }),
        ticket('vieja', { start: -100, end: -94 }),
        ticket('proxima', { start: 2, end: 8 }),
        ticket('reciente', { start: -10, end: -4 }),
      ],
      NOW,
    );

    expect(ids(current)).toEqual(['proxima', 'lejana']);
    expect(ids(history)).toEqual(['reciente', 'vieja']);
  });
});

describe('ticketBadge', () => {
  it.each([
    ['válida de un evento que no terminó', ticket('a'), 'VALID'],
    [
      'válida de un evento que ya terminó',
      ticket('a', { start: -8, end: -1 }),
      'EXPIRED',
    ],
    ['usada', ticket('a', { status: 'USED', start: -2, end: 4 }), 'USED'],
    [
      'usada de un evento que ya terminó',
      ticket('a', { status: 'USED', start: -8, end: -1 }),
      'USED',
    ],
    ['devuelta', ticket('a', { status: 'REFUNDED' }), 'VOID'],
    ['de un evento eliminado', ticket('a', { deleted: true }), 'DELETED'],
    [
      'devuelta de un evento eliminado',
      ticket('a', { status: 'REFUNDED', deleted: true }),
      'VOID',
    ],
  ])('una entrada %s se marca con su etiqueta', (_, myTicket, badge) => {
    expect(ticketBadge(myTicket, NOW)).toBe(badge);
  });
});
