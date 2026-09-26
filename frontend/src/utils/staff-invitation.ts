export type InviteRole = 'SCANNER' | 'RPP';
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
}): string | null {
  if (!invite.eventId) return 'Selecciona un evento';
  if (invite.userCount === 0) return 'Selecciona al menos un usuario';
  if (invite.role !== 'RPP') return null;

  const commission = Number(invite.commissionValue);
  if (!invite.commissionValue || commission <= 0) {
    return 'Ingresa una comisión válida';
  }
  if (invite.commissionType === 'PERCENTAGE' && commission > 100) {
    return 'El porcentaje debe estar entre 0 y 100';
  }
  return null;
}

// Body de POST /events/:id/staff. En el backend el RPP es el rol PROMOTER.
export function buildInvitationPayload(
  userId: string,
  role: InviteRole,
  commissionType: CommissionType,
  commissionValue: string,
) {
  if (role === 'SCANNER') return { userId, role: 'SCANNER' };
  return {
    userId,
    role: 'PROMOTER',
    commissionType,
    commissionValue: Number(commissionValue),
  };
}
