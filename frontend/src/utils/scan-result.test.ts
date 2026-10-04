import { describe, expect, it } from 'vitest';
import { checkInOpensLabel, scanTone } from './scan-result';

describe('scanTone', () => {
  it('una entrada válida se muestra en verde', () => {
    expect(scanTone('VALID')).toBe('success');
  });

  it.each(['USED', 'NOT_STARTED'])('%s se muestra en amarillo', (status) => {
    expect(scanTone(status)).toBe('warning');
  });

  it.each(['INVALID', 'WRONG_EVENT', 'EVENT_CLOSED', undefined])(
    '%s se muestra en rojo',
    (status) => {
      expect(scanTone(status)).toBe('error');
    },
  );
});

describe('checkInOpensLabel', () => {
  it('si el ingreso abre hoy, muestra solo la hora', () => {
    const now = new Date('2026-10-10T20:00:00-03:00');

    expect(checkInOpensLabel('2026-10-10T21:30:00-03:00', now)).toBe(
      'Se puede escanear desde las 21:30',
    );
  });

  it('si el ingreso abre otro día, muestra también el día', () => {
    const now = new Date('2026-10-09T20:00:00-03:00');

    expect(checkInOpensLabel('2026-10-10T21:30:00-03:00', now)).toBe(
      'Se puede escanear desde el sáb, 10 oct, 21:30',
    );
  });
});
