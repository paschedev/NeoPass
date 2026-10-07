import { describe, expect, it } from 'vitest';
import {
  formatClockTime,
  formatCompactNumber,
  formatCurrency,
  formatDayMonthTime,
  formatRelativeDate,
  formatShortDateTime,
  formatWeekdayDateTime,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from './format';

describe('formatCurrency', () => {
  it('muestra pesos con separador de miles y sin decimales si es entero', () => {
    expect(formatCurrency(1000)).toBe('$1.000');
    expect(formatCurrency(0)).toBe('$0');
  });

  it('con centavos muestra siempre dos decimales', () => {
    expect(formatCurrency(1500.5)).toBe('$1.500,50');
  });

  it('acepta los Decimal que llegan como texto desde la API', () => {
    expect(formatCurrency('2500.00')).toBe('$2.500');
  });
});

describe('formatRelativeDate', () => {
  const now = new Date('2026-09-26T15:00:00');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  it.each([
    [30_000, 'Justo ahora'],
    [5 * MIN, 'Hace 5 min'],
    [HOUR, 'Hace 1 hora'],
    [3 * HOUR, 'Hace 3 horas'],
    [DAY, 'Ayer'],
    [3 * DAY, 'Hace 3 días'],
  ])('hace %i ms → "%s"', (elapsed, expected) => {
    expect(formatRelativeDate(ago(elapsed), now)).toBe(expected);
  });

  it('pasada una semana muestra el día y el mes', () => {
    expect(formatRelativeDate('2026-09-10T12:00:00', now)).toBe('10 Sep');
  });

  it('una fecha futura cuenta como recién', () => {
    expect(formatRelativeDate(ago(-5 * MIN), now)).toBe('Justo ahora');
  });
});

describe('formatCompactNumber', () => {
  it.each([
    [950, '950'],
    [1000, '1k'],
    [1500, '1,5k'],
    [2_000_000, '2M'],
    [2_450_000, '2,5M'],
  ])('%i → %s', (value, expected) => {
    expect(formatCompactNumber(value)).toBe(expected);
  });
});

describe('inputs datetime-local', () => {
  const pad = (n: number) => String(n).padStart(2, '0');

  it('una fecha ISO se muestra en la hora local del navegador', () => {
    const iso = '2026-10-03T21:30:00.000Z';
    const d = new Date(iso);
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    expect(toDateTimeLocalInput(iso)).toBe(expected);
  });

  it('lo cargado en el input vuelve a la misma fecha ISO', () => {
    const iso = '2026-10-03T21:30:00.000Z';

    expect(fromDateTimeLocalInput(toDateTimeLocalInput(iso))).toBe(iso);
  });

  it('sin valor, el input queda vacío y la fecha en null', () => {
    expect(toDateTimeLocalInput(null)).toBe('');
    expect(fromDateTimeLocalInput('')).toBeNull();
  });
});

describe('formatShortDateTime', () => {
  it('muestra día/mes y hora en la hora de Argentina', () => {
    expect(formatShortDateTime('2026-10-12T23:05:00Z')).toBe('12/10 20:05');
  });
});

describe('formatDayMonthTime', () => {
  it('muestra el día, el mes abreviado y la hora en la hora de Argentina', () => {
    expect(formatDayMonthTime('2026-10-02T15:00:00Z')).toBe('2 oct, 12:00');
  });
});

describe('formatWeekdayDateTime', () => {
  it('muestra el día de la semana, el día, el mes y la hora de 24 h en la hora de Argentina', () => {
    expect(formatWeekdayDateTime('2026-10-11T02:59:00Z')).toBe(
      'sáb, 10 oct, 23:59',
    );
  });
});

describe('formatClockTime', () => {
  it('muestra la hora con segundos, de 24 h, en la hora de Argentina', () => {
    expect(formatClockTime('2026-10-11T02:41:08Z')).toBe('23:41:08');
  });
});
