import { describe, expect, it } from 'vitest';
import { canScan, canSeeRppPanel, isOrganizer } from './roles';

describe('roles', () => {
  it.each([
    ['ORGANIZER', true],
    ['ADMIN', true],
    ['CUSTOMER', false],
  ])('%s es organizador: %s', (role, expected) => {
    expect(isOrganizer({ role })).toBe(expected);
  });

  it('sin sesión no tiene ningún permiso', () => {
    expect(isOrganizer(null)).toBe(false);
    expect(canScan(null)).toBe(false);
    expect(canSeeRppPanel(null)).toBe(false);
  });

  it('escanea el organizador o quien tiene una invitación de scanner vigente', () => {
    expect(canScan({ role: 'ORGANIZER' })).toBe(true);
    expect(canScan({ role: 'CUSTOMER', isCurrentlyScanner: true })).toBe(true);
    expect(canScan({ role: 'CUSTOMER', hasBeenRpp: true })).toBe(false);
  });

  it('ve el panel RPP el organizador o quien fue RPP alguna vez', () => {
    expect(canSeeRppPanel({ role: 'ADMIN' })).toBe(true);
    expect(canSeeRppPanel({ role: 'CUSTOMER', hasBeenRpp: true })).toBe(true);
    expect(canSeeRppPanel({ role: 'CUSTOMER', isCurrentlyScanner: true })).toBe(
      false,
    );
  });
});
