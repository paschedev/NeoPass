import { describe, expect, it } from 'vitest';
import {
  buildInvitationPayload,
  invitableEvents,
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
    [{ eventId: '' }, 'Seleccioná un evento'],
    [{ userCount: 0 }, 'Seleccioná al menos un usuario'],
    [{ commissionValue: '' }, 'Ingresá una comisión válida'],
    [{ commissionValue: '0' }, 'Ingresá una comisión válida'],
  ])('%j → "%s"', (change, message) => {
    expect(validateInvitation({ ...valid, ...change })).toBe(message);
  });

  it('un co-organizador no lleva comisión, y su tope de QR free tiene que ser válido', () => {
    const coOrganizer = { ...valid, role: 'CO_ORGANIZER' as const };

    expect(
      validateInvitation({
        ...coOrganizer,
        commissionValue: '',
        freeTicketLimit: '',
      }),
    ).toBeNull();
    expect(validateInvitation({ ...coOrganizer, freeTicketLimit: '0' })).toBe(
      'El tope de QR free tiene que ser un número entero mayor a 0',
    );
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

  it('un co-organizador viaja como MANAGER con sus permisos y su tope', () => {
    expect(
      buildInvitationPayload('u1', 'CO_ORGANIZER', 'PERCENTAGE', '', {
        permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
        freeTicketLimit: 20,
      }),
    ).toEqual({
      userId: 'u1',
      role: 'MANAGER',
      permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
      freeTicketLimit: 20,
    });
  });
});

describe('invitableEvents', () => {
  const now = new Date('2026-10-10T20:00:00Z');
  const event = (id: string, overrides = {}) => ({
    id,
    title: `Evento ${id}`,
    status: 'PUBLISHED',
    startDate: '2026-10-12T02:00:00Z',
    endDate: '2026-10-12T08:00:00Z',
    ...overrides,
  });

  it('ofrece solo los eventos próximos y en curso', () => {
    const events = [
      event('proximo'),
      event('en-curso', {
        startDate: '2026-10-10T18:00:00Z',
        endDate: '2026-10-11T02:00:00Z',
      }),
      event('terminado', {
        startDate: '2026-10-01T02:00:00Z',
        endDate: '2026-10-01T08:00:00Z',
      }),
      event('cancelado', { status: 'CANCELLED' }),
    ];

    expect(invitableEvents(events, now).map((e) => e.id)).toEqual([
      'proximo',
      'en-curso',
    ]);
  });
});
