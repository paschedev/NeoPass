import { describe, expect, it } from 'vitest';
import {
  freeTicketsUpTo,
  ownFreeTicketsLabel,
  promoterFreeTicketLimitError,
  promoterFreeTicketsLabel,
} from './promoter-free-tickets';

describe('promoterFreeTicketLimitError', () => {
  it('un RRPP siempre tiene tope: la cantidad es obligatoria', () => {
    expect(promoterFreeTicketLimitError('')).toBe(
      'Indicá cuántos QR free puede mandar',
    );
    expect(promoterFreeTicketLimitError('  ')).toBe(
      'Indicá cuántos QR free puede mandar',
    );
  });

  it.each(['0', '-3', '2.5', 'diez'])(
    '"%s" no es una cantidad válida',
    (limit) => {
      expect(promoterFreeTicketLimitError(limit)).toBe(
        'El tope de QR free tiene que ser un número entero mayor a 0',
      );
    },
  );

  it('un entero mayor a 0 es válido', () => {
    expect(promoterFreeTicketLimitError('10')).toBeNull();
  });
});

describe('ownFreeTicketsLabel', () => {
  it('le dice al RRPP cuántos le quedan, nunca menos de 0, y de qué tipos', () => {
    expect(
      ownFreeTicketsLabel({ limit: 10, sent: 3, types: ['General'] }),
    ).toBe('QR free: te quedan 7 de 10 · General');
    expect(
      ownFreeTicketsLabel({ limit: 2, sent: 3, types: ['General', 'VIP'] }),
    ).toBe('QR free: te quedan 0 de 2 · General y VIP');
  });
});

describe('freeTicketsUpTo', () => {
  it('una invitación dice hasta cuántos QR free y de qué tipos', () => {
    expect(freeTicketsUpTo(10, ['General', 'VIP'])).toBe(
      'hasta 10 QR free de General y VIP',
    );
    expect(freeTicketsUpTo(5, [])).toBe('hasta 5 QR free');
  });
});

describe('promoterFreeTicketsLabel', () => {
  it('dice cuántos mandó de cuántos puede y de qué tipos', () => {
    expect(
      promoterFreeTicketsLabel({ limit: 10, sent: 3, types: ['General'] }),
    ).toBe('QR free: 3 de 10 · General');
  });

  it('sin tipos, solo la cantidad', () => {
    expect(promoterFreeTicketsLabel({ limit: 10, sent: 3, types: [] })).toBe(
      'QR free: 3 de 10',
    );
  });
});
