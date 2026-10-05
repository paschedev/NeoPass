import { EventPermission } from '@prisma/client';
import { joinPhrases } from '../common/join-phrases';

// What a co-organizer can do besides scanning, in the order of the checkboxes.
export const EVENT_PERMISSIONS: EventPermission[] = [
  'EDIT_EVENT',
  'MANAGE_BATCHES',
  'VIEW_SALES',
  'SEND_FREE_TICKETS',
  'VIEW_ATTENDEES',
  'MANAGE_STAFF',
];

const PERMISSION_PHRASE: Record<EventPermission, string> = {
  EDIT_EVENT: 'editar la info del evento',
  MANAGE_BATCHES: 'manejar tandas y precios',
  VIEW_SALES: 'ver ventas y recaudación',
  SEND_FREE_TICKETS: 'mandar QR free',
  VIEW_ATTENDEES: 'ver y exportar la lista del público',
  MANAGE_STAFF: 'manejar el staff y los pagos a RPPs',
};

const sortPermissions = (permissions: EventPermission[]) =>
  EVENT_PERMISSIONS.filter((permission) => permissions.includes(permission));

export const permissionDeniedMessage = (permission: EventPermission) =>
  `No tenés permiso para ${PERMISSION_PHRASE[permission]}`;

// Paying promoters shows what each one sold.
export function permissionsError(
  permissions: EventPermission[],
): string | null {
  if (
    permissions.includes('MANAGE_STAFF') &&
    !permissions.includes('VIEW_SALES')
  ) {
    return 'Para manejar el staff y los pagos a RPPs también tiene que poder ver las ventas';
  }
  return null;
}

// What gets stored: the permissions in order and the free ticket limit only
// when they can send free tickets.
export function coOrganizerTerms(
  permissions: EventPermission[],
  freeTicketLimit: number | null | undefined,
) {
  const sorted = sortPermissions(permissions);
  return {
    permissions: sorted,
    freeTicketLimit: sorted.includes('SEND_FREE_TICKETS')
      ? (freeTicketLimit ?? null)
      : null,
  };
}

// "escanear, ver ventas y recaudación y mandar QR free (hasta 20 entradas)",
// for the invitation and the event history.
export function describePermissions(
  permissions: EventPermission[],
  freeTicketLimit: number | null,
): string {
  return joinPhrases([
    'escanear',
    ...sortPermissions(permissions).map((permission) =>
      permission === 'SEND_FREE_TICKETS' && freeTicketLimit
        ? `${PERMISSION_PHRASE[permission]} (hasta ${freeTicketLimit} ${freeTicketLimit === 1 ? 'entrada' : 'entradas'})`
        : PERMISSION_PHRASE[permission],
    ),
  ]);
}
