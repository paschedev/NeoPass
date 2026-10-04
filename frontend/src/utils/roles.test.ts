import { describe, expect, it } from 'vitest';
import { canScan, canSeeStaffPanel, isOrganizer } from './roles';

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
    expect(canSeeStaffPanel(null)).toBe(false);
  });

  it('escanea el organizador o quien tiene una invitación de scanner vigente', () => {
    expect(canScan({ role: 'ORGANIZER' })).toBe(true);
    expect(canScan({ role: 'CUSTOMER', isCurrentlyScanner: true })).toBe(true);
    expect(canScan({ role: 'CUSTOMER', hasBeenRpp: true })).toBe(false);
  });

  it('ve Staff quien fue RPP alguna vez o puede escanear en un evento vigente', () => {
    expect(canSeeStaffPanel({ role: 'CUSTOMER', hasBeenRpp: true })).toBe(true);
    expect(
      canSeeStaffPanel({ role: 'CUSTOMER', isCurrentlyScanner: true }),
    ).toBe(true);
    expect(canSeeStaffPanel({ role: 'ORGANIZER', hasBeenRpp: true })).toBe(
      true,
    );
  });

  it('no ve Staff un comprador ni un organizador que no trabaja como staff', () => {
    expect(canSeeStaffPanel({ role: 'CUSTOMER' })).toBe(false);
    expect(canSeeStaffPanel({ role: 'ORGANIZER' })).toBe(false);
    expect(canSeeStaffPanel({ role: 'ADMIN' })).toBe(false);
  });
});
