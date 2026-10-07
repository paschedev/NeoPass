import { describe, expect, it } from 'vitest';
import {
  addToScanHistory,
  checkInOpensLabel,
  closesByItself,
  entryDeadlinePassedLabel,
  scanTone,
  usedDetailLabel,
  type ScanHistoryEntry,
} from './scan-result';

describe('scanTone', () => {
  it('una entrada válida se muestra en verde', () => {
    expect(scanTone('VALID')).toBe('success');
  });

  it.each(['USED', 'NOT_STARTED'])('%s se muestra en amarillo', (status) => {
    expect(scanTone(status)).toBe('warning');
  });

  it.each([
    'INVALID',
    'WRONG_EVENT',
    'EVENT_CLOSED',
    'NO_CONNECTION',
    undefined,
  ])('%s se muestra en rojo', (status) => {
    expect(scanTone(status)).toBe('error');
  });
});

describe('closesByItself', () => {
  it('el verde se cierra solo para que la fila avance', () => {
    expect(closesByItself('success')).toBe(true);
  });

  it.each(['warning', 'error'] as const)(
    'el %s espera a que el scanner lo cierre',
    (tone) => {
      expect(closesByItself(tone)).toBe(false);
    },
  );
});

describe('usedDetailLabel', () => {
  const now = new Date('2026-10-10T23:41:08-03:00');

  it('dice a qué hora entró, hace cuánto y que lo escaneaste vos', () => {
    expect(
      usedDetailLabel(
        {
          usedAt: '2026-10-10T23:41:00-03:00',
          usedBy: 'Juan Pérez',
          usedByYou: true,
        },
        now,
      ),
    ).toBe('Entró a las 23:41 (hace 8 s) · lo escaneaste vos');
  });

  it('si lo escaneó otra persona, dice quién', () => {
    expect(
      usedDetailLabel(
        {
          usedAt: '2026-10-10T23:35:08-03:00',
          usedBy: 'Juan Pérez',
          usedByYou: false,
        },
        now,
      ),
    ).toBe('Entró a las 23:35 (hace 6 min) · lo escaneó Juan Pérez');
  });

  it('si entró hace más de una hora, no dice hace cuánto', () => {
    expect(
      usedDetailLabel(
        {
          usedAt: '2026-10-10T21:10:00-03:00',
          usedBy: 'Juan Pérez',
          usedByYou: false,
        },
        now,
      ),
    ).toBe('Entró a las 21:10 · lo escaneó Juan Pérez');
  });

  it('si entró otro día, dice también el día', () => {
    expect(
      usedDetailLabel(
        {
          usedAt: '2026-10-09T23:00:00-03:00',
          usedBy: 'Juan Pérez',
          usedByYou: false,
        },
        now,
      ),
    ).toBe('Entró el vie, 9 oct, 23:00 · lo escaneó Juan Pérez');
  });

  it('sin datos del ingreso no dice nada', () => {
    expect(usedDetailLabel({}, now)).toBeNull();
  });
});

describe('addToScanHistory', () => {
  const entry = (id: number): ScanHistoryEntry => ({
    id,
    at: '2026-10-10T23:41:00-03:00',
    tone: 'success',
    message: 'VÁLIDO',
    detail: 'General',
  });

  it('pone el último escaneo arriba y guarda solo los 5 más recientes', () => {
    let history: ScanHistoryEntry[] = [];
    for (let id = 1; id <= 7; id++)
      history = addToScanHistory(history, entry(id));

    expect(history.map((item) => item.id)).toEqual([7, 6, 5, 4, 3]);
  });
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

describe('entryDeadlinePassedLabel', () => {
  it('a un QR free vencido le dice hasta qué hora podía entrar', () => {
    const now = new Date('2026-10-11T01:20:00-03:00');

    expect(entryDeadlinePassedLabel('2026-10-11T01:00:00-03:00', now)).toBe(
      'Podía entrar hasta las 01:00',
    );
  });

  it('si venció otro día, dice también el día', () => {
    const now = new Date('2026-10-12T01:20:00-03:00');

    expect(entryDeadlinePassedLabel('2026-10-11T01:00:00-03:00', now)).toBe(
      'Podía entrar hasta el dom, 11 oct, 01:00',
    );
  });
});
