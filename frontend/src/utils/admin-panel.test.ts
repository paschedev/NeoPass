import { describe, expect, it } from 'vitest';
import { adminPanelUrl, canResendTicket } from './admin-panel';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-14T15:00:00.000Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

const ticket = (overrides = {}, event = {}) => ({
  status: 'VALID' as const,
  event: {
    status: 'PUBLISHED',
    startDate: at(24),
    endDate: at(30),
    deletedAt: null,
    ...event,
  },
  ...overrides,
});

describe('adminPanelUrl', () => {
  it('deja la pestaña y la búsqueda en la URL', () => {
    expect(adminPanelUrl('tickets', 'ana@example.com')).toBe(
      '/panel/admin?tab=tickets&q=ana%40example.com',
    );
  });

  it('sin búsqueda deja solo la pestaña', () => {
    expect(adminPanelUrl('eventos', '')).toBe('/panel/admin?tab=eventos');
  });
});

describe('canResendTicket', () => {
  it('una entrada válida de un evento que no terminó se puede reenviar', () => {
    expect(canResendTicket(ticket(), now)).toBe(true);
    expect(
      canResendTicket(ticket({}, { startDate: at(-1), endDate: at(5) }), now),
    ).toBe(true);
  });

  it.each(['USED', 'CANCELLED', 'REFUNDED'] as const)(
    'una entrada %s no se reenvía',
    (status) => {
      expect(canResendTicket(ticket({ status }), now)).toBe(false);
    },
  );

  it.each([
    ['eliminado', { deletedAt: at(-1) }],
    ['finalizado', { status: 'FINISHED' }],
    ['cancelado', { status: 'CANCELLED' }],
    ['que ya pasó su fin', { startDate: at(-8), endDate: at(-2) }],
  ])('la entrada de un evento %s no se reenvía', (_, event) => {
    expect(canResendTicket(ticket({}, event), now)).toBe(false);
  });
});
