import { BadRequestException } from '@nestjs/common';
import { joinPhrases } from '../common/join-phrases';

export const NO_FREE_TICKET_TYPES =
  'Elegí al menos un tipo de entrada para los QR free';
export const UNKNOWN_FREE_TICKET_TYPE = 'Elegí tipos de entrada del evento';

// Ticket type names are typed by hand in each batch: "VIP" and "vip " are the
// same type, in any batch.
const typeKey = (name: string) => name.trim().toLocaleLowerCase('es');

// Whether a free ticket of this type is one they can send.
export const allowsFreeTicketType = (allowed: string[], typeName: string) =>
  allowed.some((name) => typeKey(name) === typeKey(typeName));

// The types to store, once each and as the event spells them, in the order
// they were chosen. None chosen, or one that is not of the event, is a 400.
export function pickFreeTicketTypes(
  chosen: string[] | undefined,
  eventTypeNames: string[],
): string[] {
  if (!chosen?.length) throw new BadRequestException(NO_FREE_TICKET_TYPES);
  const eventSpelling = new Map<string, string>();
  for (const name of eventTypeNames) {
    if (!eventSpelling.has(typeKey(name))) {
      eventSpelling.set(typeKey(name), name);
    }
  }
  const types = new Set<string>();
  for (const name of chosen) {
    const spelled = eventSpelling.get(typeKey(name));
    if (!spelled) throw new BadRequestException(UNKNOWN_FREE_TICKET_TYPE);
    types.add(spelled);
  }
  return [...types];
}

// "hasta 10 QR free de General y VIP", for invitations and notices.
export const freeTicketsUpTo = (limit: number, types: string[]) =>
  `hasta ${limit} QR free${types.length > 0 ? ` de ${joinPhrases(types)}` : ''}`;

// The batches with only the types they can send; a batch left empty goes.
export function allowedFreeTicketBatches<
  T extends { name: string; ticketTypes: { name: string }[] },
>(batches: T[], allowed: string[]) {
  return batches
    .map((batch) => ({
      ...batch,
      ticketTypes: batch.ticketTypes.filter((type) =>
        allowsFreeTicketType(allowed, type.name),
      ),
    }))
    .filter((batch) => batch.ticketTypes.length > 0);
}
