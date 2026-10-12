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

// What gets stored: the permissions in order, and the free ticket limit and
// types only when they can send free tickets.
export function coOrganizerTerms(
  permissions: EventPermission[],
  freeTicketLimit: number | null | undefined,
  freeTicketTypes: string[],
) {
  const sorted = sortPermissions(permissions);
  const sendsFreeTickets = sorted.includes('SEND_FREE_TICKETS');
  return {
    permissions: sorted,
    freeTicketLimit: sendsFreeTickets ? (freeTicketLimit ?? null) : null,
    freeTicketTypes: sendsFreeTickets ? freeTicketTypes : [],
  };
}

function freeTicketsPhrase(
  freeTicketLimit: number | null,
  freeTicketTypes: string[],
) {
  const types =
    freeTicketTypes.length > 0 ? ` de ${joinPhrases(freeTicketTypes)}` : '';
  const limit = freeTicketLimit
    ? ` (hasta ${freeTicketLimit} ${freeTicketLimit === 1 ? 'entrada' : 'entradas'})`
    : '';
  return `${PERMISSION_PHRASE.SEND_FREE_TICKETS}${types}${limit}`;
}

// "escanear, ver ventas y recaudación y mandar QR free de General (hasta 20
// entradas)", for the invitation and the event history.
export function describePermissions(
  permissions: EventPermission[],
  freeTicketLimit: number | null,
  freeTicketTypes: string[],
): string {
  return joinPhrases([
    'escanear',
    ...sortPermissions(permissions).map((permission) =>
      permission === 'SEND_FREE_TICKETS'
        ? freeTicketsPhrase(freeTicketLimit, freeTicketTypes)
        : PERMISSION_PHRASE[permission],
    ),
  ]);
}
