import { describe, expect, it } from 'vitest';
import {
  buildInvitationPayload,
  normalizeCommission,
  sanitizeCommissionInput,
  validateInvitation,
} from './staff-invitation';

describe('sanitizeCommissionInput', () => {
  it.each([
    ['12,5', '12.5'],
    ['150', '100.0'],
    ['', ''],
  ])('porcentaje: "%s" queda "%s"', (raw, expected) => {
    expect(sanitizeCommissionInput(raw, 'PERCENTAGE')).toBe(expected);
  });

  it.each(['12.55', 'abc', '1.2.3'])('porcentaje: "%s" no se acepta', (raw) => {
    expect(sanitizeCommissionInput(raw, 'PERCENTAGE')).toBeNull();
  });

  it('monto fijo: solo pesos enteros', () => {
    expect(sanitizeCommissionInput('1500', 'FIXED')).toBe('1500');
    expect(sanitizeCommissionInput('15.5', 'FIXED')).toBeNull();
  });
});

describe('normalizeCommission', () => {
  it('al salir del campo, el porcentaje queda con un decimal', () => {
    expect(normalizeCommission('12', 'PERCENTAGE')).toBe('12.0');
    expect(normalizeCommission('1500', 'FIXED')).toBe('1500');
    expect(normalizeCommission('', 'PERCENTAGE')).toBe('');
  });
});

describe('validateInvitation', () => {
  const valid = {
    eventId: 'ev-1',
    userCount: 2,
    role: 'RPP' as const,
    commissionType: 'PERCENTAGE' as const,
    commissionValue: '10.0',
  };

  it('una invitación completa es válida', () => {
    expect(validateInvitation(valid)).toBeNull();
    expect(
      validateInvitation({ ...valid, role: 'SCANNER', commissionValue: '' }),
    ).toBeNull();
  });

  it.each([
    [{ eventId: '' }, 'Selecciona un evento'],
    [{ userCount: 0 }, 'Selecciona al menos un usuario'],
    [{ commissionValue: '' }, 'Ingresa una comisión válida'],
    [{ commissionValue: '0' }, 'Ingresa una comisión válida'],
  ])('%j → "%s"', (change, message) => {
    expect(validateInvitation({ ...valid, ...change })).toBe(message);
  });
});

describe('buildInvitationPayload', () => {
  it('un scanner va sin comisión', () => {
    expect(buildInvitationPayload('u1', 'SCANNER', 'PERCENTAGE', '10')).toEqual(
      { userId: 'u1', role: 'SCANNER' },
    );
  });

  it('un RPP viaja como PROMOTER con su comisión numérica', () => {
    expect(buildInvitationPayload('u1', 'RPP', 'FIXED', '1500')).toEqual({
      userId: 'u1',
      role: 'PROMOTER',
      commissionType: 'FIXED',
      commissionValue: 1500,
    });
  });
});
