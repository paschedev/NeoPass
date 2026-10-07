import { describe, expect, it } from 'vitest';
import {
  buildEventUpdate,
  closedEventLabel,
  getEventPhase,
  isEventPublic,
} from './event-edit';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-01T20:00:00Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

function event(overrides: Partial<Parameters<typeof getEventPhase>[0]>) {
  return {
    status: 'PUBLISHED',
    startDate: at(24),
    endDate: at(30),
    ...overrides,
  };
}

describe('getEventPhase', () => {
  it('un evento que todavía no empezó se edita entero', () => {
    expect(getEventPhase(event({}), now)).toBe('NOT_STARTED');
  });

  it('un evento que ya empezó y no terminó está en curso', () => {
    expect(
      getEventPhase(event({ startDate: at(-1), endDate: at(3) }), now),
    ).toBe('IN_PROGRESS');
  });

  it('un evento cuyo fin ya pasó está cerrado aunque siga publicado', () => {
    expect(
      getEventPhase(event({ startDate: at(-6), endDate: at(-1) }), now),
    ).toBe('CLOSED');
  });

  it.each(['FINISHED', 'CANCELLED'])(
    'un evento %s está cerrado aunque sus fechas sean futuras',
    (status) => {
      expect(getEventPhase(event({ status }), now)).toBe('CLOSED');
    },
  );
});

describe('un evento eliminado', () => {
  it('queda cerrado aunque su fecha no haya llegado', () => {
    expect(
      getEventPhase({ ...event({}), deletedAt: now.toISOString() }, now),
    ).toBe('CLOSED');
  });
});

describe('isEventPublic', () => {
  it('un evento publicado que no terminó tiene página pública, empezado o no', () => {
    expect(isEventPublic(event({}), now)).toBe(true);
    expect(
      isEventPublic(event({ startDate: at(-1), endDate: at(3) }), now),
    ).toBe(true);
  });

  it.each(['DRAFT', 'PAUSED', 'FINISHED', 'CANCELLED'])(
    'un evento %s no tiene página pública',
    (status) => {
      expect(isEventPublic(event({ status }), now)).toBe(false);
    },
  );

  it('un evento publicado cuyo fin ya pasó no tiene página pública', () => {
    expect(
      isEventPublic(event({ startDate: at(-6), endDate: at(-1) }), now),
    ).toBe(false);
  });

  it('un evento eliminado no tiene página pública', () => {
    expect(
      isEventPublic({ ...event({}), deletedAt: now.toISOString() }, now),
    ).toBe(false);
  });
});

describe('closedEventLabel', () => {
  it('distingue un evento cancelado de uno finalizado', () => {
    expect(closedEventLabel({ status: 'CANCELLED' })).toBe('Evento cancelado');
    expect(closedEventLabel({ status: 'FINISHED' })).toBe('Evento finalizado');
    expect(closedEventLabel({ status: 'PUBLISHED' })).toBe(
      'Evento finalizado',
    );
  });

  it('un evento eliminado dice que fue eliminado', () => {
    expect(
      closedEventLabel({ status: 'PUBLISHED', deletedAt: now.toISOString() }),
    ).toBe('Evento eliminado');
  });
});

describe('buildEventUpdate', () => {
  const values = {
    title: 'Fiesta',
    description: 'Descripción',
    imageUrl: 'https://res.cloudinary.com/neopass/image/upload/f.jpg',
    youtubeLink: null,
    startDate: at(24),
    endDate: at(30),
    venueName: 'Club',
    venueAddress: 'Calle 123',
    venueCity: 'Buenos Aires',
    venuePlaceId: 'ChIJS4Xb0z_LvJURM1UCa7Y8t7k',
    latitude: -34.6037389,
    longitude: -58.3815704,
    batches: [{ name: 'Preventa' }],
  };

  it('antes de empezar manda todos los campos', () => {
    expect(buildEventUpdate(values, 'NOT_STARTED')).toEqual(values);
  });

  it('en curso no manda el inicio, el lugar, su ubicación ni las tandas', () => {
    expect(buildEventUpdate(values, 'IN_PROGRESS')).toEqual({
      title: 'Fiesta',
      description: 'Descripción',
      imageUrl: values.imageUrl,
      youtubeLink: null,
      endDate: at(30),
    });
  });
});
