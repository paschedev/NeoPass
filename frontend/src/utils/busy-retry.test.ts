import { describe, expect, it } from 'vitest';
import { formatCountdown, isBusyStatus, retryDelayMs } from './busy-retry';

const noJitter = () => 0;

describe('reintentos con mucha demanda', () => {
  it('el límite por minuto y la base saturada son "mucha gente", no un error', () => {
    expect(isBusyStatus(429)).toBe(true);
    expect(isBusyStatus(503)).toBe(true);
    expect(isBusyStatus(500)).toBe(false);
    expect(isBusyStatus(404)).toBe(false);
  });

  it('espera lo que dice el servidor', () => {
    expect(retryDelayMs(1, '12', noJitter)).toBe(12_000);
  });

  it('sin indicación del servidor, espera cada vez más, hasta un minuto', () => {
    expect(retryDelayMs(1, null, noJitter)).toBe(5_000);
    expect(retryDelayMs(2, null, noJitter)).toBe(10_000);
    expect(retryDelayMs(3, null, noJitter)).toBe(20_000);
    expect(retryDelayMs(10, null, noJitter)).toBe(60_000);
    expect(retryDelayMs(1, 'mañana', noJitter)).toBe(5_000);
    expect(retryDelayMs(1, '600', noJitter)).toBe(60_000);
  });

  it('suma hasta un segundo al azar para que no vuelvan todos juntos', () => {
    expect(retryDelayMs(1, '12', () => 0.999)).toBe(12_999);
  });

  it('la cuenta regresiva tiene siempre el mismo ancho', () => {
    expect(formatCountdown(7)).toBe('0:07');
    expect(formatCountdown(60)).toBe('1:00');
  });
});
