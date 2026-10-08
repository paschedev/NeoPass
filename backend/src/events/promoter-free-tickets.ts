import { EventPermission } from '@prisma/client';

type PromoterTerms = {
  id: string;
  permissions: EventPermission[];
  freeTicketLimit: number | null;
};

// A promoter sends free tickets only if the owner let them, and always with a
// limit: what gets stored on their staff row (null = they can't).
export function promoterFreeTicketTerms(freeTicketLimit: number | null) {
  return freeTicketLimit === null
    ? { permissions: [] as EventPermission[], freeTicketLimit: null }
    : {
        permissions: ['SEND_FREE_TICKETS'] as EventPermission[],
        freeTicketLimit,
      };
}

// Their quota and how much of it they used, or null if they can't send.
export function promoterFreeTickets(
  promoter: PromoterTerms,
  sentByPromoter: Map<string, number>,
) {
  return promoter.permissions.includes('SEND_FREE_TICKETS') &&
    promoter.freeTicketLimit !== null
    ? {
        limit: promoter.freeTicketLimit,
        sent: sentByPromoter.get(promoter.id) ?? 0,
      }
    : null;
}

// What the promoter reads when the owner changes it.
export function promoterFreeTicketsNotice(
  eventTitle: string,
  freeTicketLimit: number | null,
) {
  return freeTicketLimit === null
    ? `Ya no podés mandar QR free en "${eventTitle}".`
    : `Ahora podés mandar hasta ${freeTicketLimit} QR free en "${eventTitle}".`;
}
