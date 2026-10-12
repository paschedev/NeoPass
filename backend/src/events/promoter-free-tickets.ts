import { EventPermission } from '@prisma/client';
import { freeTicketsUpTo } from './free-ticket-types';

type PromoterTerms = {
  id: string;
  permissions: EventPermission[];
  freeTicketLimit: number | null;
  freeTicketTypes: string[];
};

// A promoter sends free tickets only if the owner let them, always with a
// limit and of the types the owner chose: what gets stored on their staff row
// (a null limit = they can't).
export function promoterFreeTicketTerms(
  freeTicketLimit: number | null,
  freeTicketTypes: string[],
) {
  return freeTicketLimit === null
    ? {
        permissions: [] as EventPermission[],
        freeTicketLimit: null,
        freeTicketTypes: [],
      }
    : {
        permissions: ['SEND_FREE_TICKETS'] as EventPermission[],
        freeTicketLimit,
        freeTicketTypes,
      };
}

// A co-organizer allowed to send free tickets sends them under that rule, even
// if they also promote the event: their promoter quota doesn't apply.
export const coOrganizerSendsFreeTickets = (
  coOrganizer: { permissions: EventPermission[] } | null | undefined,
) => coOrganizer?.permissions.includes('SEND_FREE_TICKETS') ?? false;

// Their quota, how much of it they used and of which types, or null if they
// can't send.
export function promoterFreeTickets(
  promoter: PromoterTerms,
  sentByPromoter: Map<string, number>,
) {
  return promoter.permissions.includes('SEND_FREE_TICKETS') &&
    promoter.freeTicketLimit !== null
    ? {
        limit: promoter.freeTicketLimit,
        sent: sentByPromoter.get(promoter.id) ?? 0,
        types: promoter.freeTicketTypes,
      }
    : null;
}

// What the promoter reads when the owner changes it.
export function promoterFreeTicketsNotice(
  eventTitle: string,
  freeTicketLimit: number | null,
  freeTicketTypes: string[],
) {
  return freeTicketLimit === null
    ? `Ya no podés mandar QR free en "${eventTitle}".`
    : `Ahora podés mandar ${freeTicketsUpTo(freeTicketLimit, freeTicketTypes)} en "${eventTitle}".`;
}
