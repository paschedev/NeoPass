export type EventPermission =
  | 'EDIT_EVENT'
  | 'MANAGE_BATCHES'
  | 'VIEW_SALES'
  | 'SEND_FREE_TICKETS'
  | 'VIEW_ATTENDEES'
  | 'MANAGE_STAFF';

// Lo que un co-organizador puede hacer además de escanear, en el orden de las
// casillas. Espejo de backend/src/events/co-organizers.ts.
export const PERMISSION_OPTIONS: {
  value: EventPermission;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    value: 'EDIT_EVENT',
    label: 'Editar la info del evento',
    short: 'Editar info',
    description: 'Título, descripción, flyer, fechas y lugar.',
  },
  {
    value: 'MANAGE_BATCHES',
    label: 'Tandas y precios',
    short: 'Tandas',
    description: 'Crear y cambiar tandas, precios y stock; cortar o reabrir la venta.',
  },
  {
    value: 'VIEW_SALES',
    label: 'Ver ventas y recaudación',
    short: 'Ver ventas',
    description: 'Lo vendido y lo recaudado por tanda.',
  },
  {
    value: 'SEND_FREE_TICKETS',
    label: 'QR free',
    short: 'QR free',
    description: 'Mandar entradas gratis; ve solo las que mandó.',
  },
  {
    value: 'VIEW_ATTENDEES',
    label: 'Asistentes y exportar',
    short: 'Asistentes',
    description: 'La lista de asistentes con nombre y email, y el CSV.',
  },
  {
    value: 'MANAGE_STAFF',
    label: 'Staff y pagos a RPPs',
    short: 'Staff',
    description: 'Invitar scanners y RPPs y registrar pagos. Incluye ver ventas.',
  },
];

const ORDER = PERMISSION_OPTIONS.map((option) => option.value);

const sorted = (permissions: EventPermission[]) =>
  ORDER.filter((permission) => permissions.includes(permission));

// Pagar a los RPPs muestra lo que vendió cada uno: "Staff y pagos" necesita
// "Ver ventas" (el backend rechaza uno sin el otro).
export function togglePermission(
  permissions: EventPermission[],
  permission: EventPermission,
): EventPermission[] {
  if (permissions.includes(permission)) {
    const dropped =
      permission === 'VIEW_SALES' ? ['VIEW_SALES', 'MANAGE_STAFF'] : [permission];
    return sorted(permissions.filter((p) => !dropped.includes(p)));
  }
  const added: EventPermission[] =
    permission === 'MANAGE_STAFF' ? ['VIEW_SALES', 'MANAGE_STAFF'] : [permission];
  return sorted([...permissions, ...added]);
}

export function freeTicketLimitError(limit: string): string | null {
  if (limit.trim() === '') return null;
  return /^\d+$/.test(limit.trim()) && Number(limit) >= 1
    ? null
    : 'El tope de QR free tiene que ser un número entero mayor a 0';
}

// Lo que se manda al invitar o al cambiar permisos. Sin QR free no hay tope.
export function buildCoOrganizerTerms(
  permissions: EventPermission[],
  limit: string,
) {
  const canSend = permissions.includes('SEND_FREE_TICKETS');
  return {
    permissions: sorted(permissions),
    freeTicketLimit: canSend && limit.trim() !== '' ? Number(limit) : null,
  };
}

// "Escanear · Ver ventas · QR free (hasta 20)".
export function permissionsSummary(
  permissions: EventPermission[],
  freeTicketLimit: number | null,
): string {
  const parts = PERMISSION_OPTIONS.filter((option) =>
    permissions.includes(option.value),
  ).map((option) =>
    option.value === 'SEND_FREE_TICKETS' && freeTicketLimit
      ? `${option.short} (hasta ${freeTicketLimit})`
      : option.short,
  );
  return ['Escanear', ...parts].join(' · ');
}

export const INVITATION_STATUS_LABEL: Record<string, string> = {
  ACCEPTED: 'Aceptó',
  PENDING: 'Pendiente',
  REJECTED: 'Rechazó',
};
