import { describe, expect, it } from 'vitest';
import {
  promoterFreeTicketLimitError,
  promoterFreeTicketsLabel,
} from './promoter-free-tickets';

describe('promoterFreeTicketLimitError', () => {
  it('un RPP siempre tiene tope: la cantidad es obligatoria', () => {
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

describe('promoterFreeTicketsLabel', () => {
  it('dice cuántos mandó de cuántos puede', () => {
    expect(promoterFreeTicketsLabel({ limit: 10, sent: 3 })).toBe(
      'QR free: 3 de 10',
    );
  });
});
