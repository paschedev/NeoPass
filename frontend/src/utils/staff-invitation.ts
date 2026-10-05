import { freeTicketLimitError, type EventPermission } from './co-organizers';
import { getEventPhase } from './event-edit';

export type InviteRole = 'SCANNER' | 'RPP' | 'CO_ORGANIZER';
export type CommissionType = 'PERCENTAGE' | 'FIXED';

export const MAX_INVITEES = 10;

// Filtra lo que se tipea en la comisión: porcentaje con un decimal (tope
// 100) o pesos enteros. Devuelve null si la tecla no se acepta.
export function sanitizeCommissionInput(
  raw: string,
  type: CommissionType,
): string | null {
  if (type === 'FIXED') return /^\d*$/.test(raw) ? raw : null;
  if (raw === '') return '';

  const value = raw.replace(',', '.');
  if (!/^\d*\.?\d*$/.test(value)) return null;
  const [, decimals] = value.split('.');
  if (decimals && decimals.length > 1) return null;
  return parseFloat(value) > 100 ? '100.0' : value;
}

// Al salir del campo, el porcentaje queda con un decimal ("12" → "12.0").
export function normalizeCommission(value: string, type: CommissionType) {
  if (!value || type !== 'PERCENTAGE') return value;
  const num = parseFloat(value);
  return isNaN(num) ? value : num.toFixed(1);
}

export function validateInvitation(invite: {
  eventId: string;
  userCount: number;
  role: InviteRole;
  commissionType: CommissionType;
  commissionValue: string;
  freeTicketLimit?: string;
}): string | null {
  if (!invite.eventId) return 'Seleccioná un evento';
  if (invite.userCount === 0) return 'Seleccioná al menos un usuario';
  if (invite.role === 'CO_ORGANIZER') {
    return freeTicketLimitError(invite.freeTicketLimit ?? '');
  }
  if (invite.role !== 'RPP') return null;

  const commission = Number(invite.commissionValue);
  if (!invite.commissionValue || commission <= 0) {
    return 'Ingresá una comisión válida';
  }
  if (invite.commissionType === 'PERCENTAGE' && commission > 100) {
    return 'El porcentaje debe estar entre 0 y 100';
  }
  return null;
}

// Body de POST /events/:id/staff. En el backend el RPP es el rol PROMOTER y
// el co-organizador, MANAGER.
export function buildInvitationPayload(
  userId: string,
  role: InviteRole,
  commissionType: CommissionType,
  commissionValue: string,
  coOrganizer?: {
    permissions: EventPermission[];
    freeTicketLimit: number | null;
  },
) {
  if (role === 'SCANNER') return { userId, role: 'SCANNER' };
  if (role === 'CO_ORGANIZER') return { userId, role: 'MANAGER', ...coOrganizer };
  return {
    userId,
    role: 'PROMOTER',
    commissionType,
    commissionValue: Number(commissionValue),
  };
}

// Solo se suma staff a eventos que no terminaron: un RPP ya no podría vender.
export function invitableEvents<
  T extends { status: string; startDate: string; endDate: string },
>(events: T[], now: Date): T[] {
  return events.filter((event) => getEventPhase(event, now) !== 'CLOSED');
}
