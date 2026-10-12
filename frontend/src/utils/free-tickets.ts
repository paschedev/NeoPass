import { z } from 'zod';
import { getEventPhase } from './event-edit';
import { formatWeekdayDateTime } from './format';

// Espejo de backend/src/tickets/free-tickets.ts.
export const MAX_FREE_TICKETS_PER_GRANT = 10;

const HALF_HOUR = 30 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

// Respuesta de /events/organizer/:id/free-tickets: un envío de QR free.
export interface FreeTicketGrant {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  ticketType: { id: string; name: string };
  quantity: number;
  checkedIn: number;
  status: 'ACTIVE' | 'CANCELLED';
  validUntil: string | null;
  createdAt: string;
  lastSentAt: string;
  // Quién lo mandó: el dueño o un co-organizador.
  issuedById: string;
  issuedBy: { name: string };
}

const pad = (n: number) => String(n).padStart(2, '0');

// Las horas límite que se pueden elegir: cada media hora después del inicio
// (y de ahora) hasta el fin del evento. Así no hace falta elegir la fecha y
// nunca queda fuera del evento, aunque cruce la medianoche.
// Lo enviado sin las anuladas que nadie usó: lo que cuenta para el tope de un
// co-organizador.
export function freeTicketsSent(
  grants: Pick<FreeTicketGrant, 'status' | 'quantity' | 'checkedIn'>[],
): number {
  return grants.reduce(
    (sum, grant) =>
      sum + (grant.status === 'ACTIVE' ? grant.quantity : grant.checkedIn),
    0,
  );
}

export function entryDeadlineOptions(
  event: { startDate: string; endDate: string },
  now: Date,
): { value: string; label: string }[] {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate).getTime();
  const showDay = end - start.getTime() > DAY;

  const first = new Date(Math.max(start.getTime(), now.getTime()));
  first.setSeconds(0, 0);
  first.setMinutes(first.getMinutes() < 30 ? 30 : 60);

  const options = [];
  for (let time = first.getTime(); time <= end; time += HALF_HOUR) {
    const date = new Date(time);
    const value = date.toISOString();
    options.push({
      value,
      label: showDay
        ? formatWeekdayDateTime(value)
        : `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    });
  }
  return options;
}

// Los nombres de tipo se escriben a mano en cada tanda: "VIP" y "vip " son el
// mismo tipo, en cualquier tanda. Espejo de backend/src/events/free-ticket-types.ts.
const typeKey = (name: string) => name.trim().toLocaleLowerCase('es');

// Si un QR free de este tipo está entre los que puede regalar.
export const allowsFreeTicketType = (allowed: string[], name: string) =>
  allowed.some((allowedName) => typeKey(allowedName) === typeKey(name));

// Los nombres de tipo del evento, una vez cada uno y en el orden de las tandas:
// las casillas de qué tipos puede regalar alguien.
export function eventTicketTypeNames(
  batches: { ticketTypes: { name: string }[] }[],
): string[] {
  const names: string[] = [];
  for (const type of batches.flatMap((batch) => batch.ticketTypes)) {
    if (!allowsFreeTicketType(names, type.name)) names.push(type.name);
  }
  return names;
}

// De lo tildado, los tipos que el evento tiene hoy, en su orden: un tipo
// renombrado o borrado deja de estar.
export const chosenFreeTicketTypes = (selected: string[], names: string[]) =>
  names.filter((name) => allowsFreeTicketType(selected, name));

// "General", "General y VIP", "General, VIP y Mesa".
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

export function freeTicketTypesError(types: string[]): string | null {
  return types.length === 0
    ? 'Elegí al menos un tipo de entrada para los QR free'
    : null;
}

// Los tipos de entrada que se pueden mandar como QR free, de todas las tandas
// (también las ocultas): "General · Preventa". Con una lista de permitidos,
// solo esos; sin lista (quien organiza), todos.
export function freeTicketTypeOptions(
  batches: { name: string; ticketTypes: { id: string; name: string }[] }[],
  allowed: string[] | null = null,
): { id: string; label: string }[] {
  return batches.flatMap((batch) =>
    batch.ticketTypes
      .filter((type) => !allowed || allowsFreeTicketType(allowed, type.name))
      .map((type) => ({
        id: type.id,
        label: `${type.name} · ${batch.name}`,
      })),
  );
}

// Por qué no se pueden mandar QR free de este evento, o null si se puede. El
// servidor aplica las mismas reglas. "restricted": quien manda tiene una
// lista de tipos permitidos (co-organizador o RPP), así que si no queda
// ninguno, lo pide.
export function freeTicketsBlockedReason(
  event: { status: string; startDate: string; endDate: string },
  ticketTypesCount: number,
  now: Date,
  restricted = false,
): string | null {
  if (getEventPhase(event, now) === 'CLOSED') {
    return 'El evento terminó: ya no se pueden mandar QR free.';
  }
  if (event.status === 'DRAFT') return 'Publicá el evento para mandar QR free.';
  if (ticketTypesCount === 0) {
    return restricted
      ? 'No tenés tipos de entrada habilitados para QR free. Pedíselos a quien organiza el evento.'
      : 'Creá un tipo de entrada para mandar QR free.';
  }
  return null;
}

// Espejo de SendFreeTicketsDto. La cantidad y la hora límite llegan de un
// <select>, siempre como texto.
export const freeTicketsSchema = z.object({
  ticketTypeId: z.string().min(1, 'Elegí un tipo de entrada'),
  quantity: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(MAX_FREE_TICKETS_PER_GRANT)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.string().email('Poné un correo válido')),
  name: z
    .string()
    .trim()
    .max(60, 'El nombre puede tener hasta 60 caracteres')
    .transform((name) => name || null),
  validUntil: z.string().transform((value) => value || null),
});

export type FreeTicketsFormInput = z.input<typeof freeTicketsSchema>;
export type FreeTicketsFormOutput = z.output<typeof freeTicketsSchema>;
