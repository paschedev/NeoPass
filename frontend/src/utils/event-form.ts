import { z } from 'zod';
import { getBatchWindowErrors } from './batches';
import type { EventFormValues, EventPhase } from './event-edit';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from './format';

// Fechas del formulario en el formato de datetime-local ("2026-10-10T22:00").
type FormDates = { startDate: string; endDate: string };
type SavedWindow = {
  id?: string;
  publishAt: string | null;
  closeAt: string | null;
};

export type EventDateRules = {
  // Al crear, el evento todavía no empezó.
  phase: Exclude<EventPhase, 'CLOSED'>;
  // Lo guardado del evento que se edita.
  saved?: FormDates & { batches?: SavedWindow[] };
};

const required = (message: string) => z.string().trim().min(1, message);

// Espejo de backend/src/events/event-limits.ts.
const EVENT_LIMITS = {
  title: 60,
  description: 2000,
  venueName: 60,
  venueAddress: 120,
  batchName: 30,
  ticketTypeName: 30,
  stock: 100_000,
} as const;

const limitedText = (message: string, max: number, tooLong: string) =>
  required(message).max(max, tooLong);

const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
];
const YOUTUBE_MESSAGE = 'El link tiene que ser de un video de YouTube';

// Los inputs numéricos guardan texto; vacío no es 0.
const numberInput = (emptyMessage: string) =>
  z.union([z.string(), z.number()]).transform((value, ctx) => {
    const text = String(value).trim();
    if (text === '') {
      ctx.addIssue({ code: 'custom', message: emptyMessage });
      return z.NEVER;
    }
    return Number(text);
  });

// Tope de las columnas Decimal(10, 2) de la base.
const MAX_PRICE = 99_999_999.99;

const ticketTypeSchema = z
  .object({
    id: z.string().optional(),
    tempId: z.string().optional(),
    name: limitedText(
      'Poné el nombre de la entrada',
      EVENT_LIMITS.ticketTypeName,
      `El nombre de la entrada puede tener hasta ${EVENT_LIMITS.ticketTypeName} caracteres`,
    ),
    price: numberInput('Poné el precio (0 si es gratis)').pipe(
      z
        .number()
        .min(0, 'El precio no puede ser negativo')
        .max(MAX_PRICE, 'El precio máximo es $99.999.999,99'),
    ),
    stock: numberInput('Poné el stock').pipe(
      z
        .number()
        .int('El stock tiene que ser un número entero')
        .min(1, 'El stock tiene que ser mayor a 0')
        .max(EVENT_LIMITS.stock, 'El stock máximo es 100.000'),
    ),
    sold: z.number().optional(),
    reserved: z.number().optional(),
  })
  .superRefine((ticket, ctx) => {
    const taken = (ticket.sold ?? 0) + (ticket.reserved ?? 0);
    if (ticket.stock < taken) {
      ctx.addIssue({
        code: 'custom',
        path: ['stock'],
        message: `El stock no puede ser menor a lo vendido y reservado (${taken})`,
      });
    }
  });

const batchSchema = z.object({
  id: z.string().optional(),
  tempId: z.string().optional(),
  name: limitedText(
    'Poné el nombre de la tanda',
    EVENT_LIMITS.batchName,
    `El nombre de la tanda puede tener hasta ${EVENT_LIMITS.batchName} caracteres`,
  ),
  isVisible: z.boolean(),
  publishAt: z.string().nullable(),
  closeAt: z.string().nullable(),
  publishWhenPreviousSoldOut: z.boolean().optional(),
  ticketTypes: z.array(ticketTypeSchema),
});

// Espejo de las reglas de fechas de backend/src/events/events.service.ts.
export function buildEventSchema(
  rules: EventDateRules,
  now: () => Date = () => new Date(),
) {
  const savedStarts = new Map(
    (rules.saved?.batches ?? []).map((batch) => [batch.id, batch.publishAt]),
  );
  return z
    .object({
      title: limitedText(
        'Poné el nombre del evento',
        EVENT_LIMITS.title,
        `El título puede tener hasta ${EVENT_LIMITS.title} caracteres`,
      ),
      description: limitedText(
        'Contá de qué trata el evento',
        EVENT_LIMITS.description,
        `La descripción puede tener hasta ${EVENT_LIMITS.description} caracteres`,
      ),
      imageUrl: required('Subí el flyer del evento'),
      youtubeLink: z.union([
        z.literal(''),
        z.url({
          protocol: /^https?$/,
          hostname: new RegExp(
            `^(${YOUTUBE_HOSTS.map((host) => host.replaceAll('.', '\\.')).join('|')})$`,
          ),
          error: YOUTUBE_MESSAGE,
        }),
      ]),
      startDate: z.string(),
      endDate: z.string(),
      venueName: limitedText(
        'Poné el nombre del lugar',
        EVENT_LIMITS.venueName,
        `El nombre del lugar puede tener hasta ${EVENT_LIMITS.venueName} caracteres`,
      ),
      venueAddress: limitedText(
        'Poné la dirección',
        EVENT_LIMITS.venueAddress,
        `La dirección puede tener hasta ${EVENT_LIMITS.venueAddress} caracteres`,
      ),
      // Ubicación en el mapa, opcional: los tres datos van juntos o vacíos.
      venueCity: z.string().nullable(),
      venuePlaceId: z.string().nullable(),
      latitude: z.number().nullable(),
      longitude: z.number().nullable(),
      batches: z.array(batchSchema),
    })
    .superRefine((values, ctx) => {
      const issue = (path: (string | number)[], message: string) =>
        ctx.addIssue({ code: 'custom', path, message });
      const current = now();

      if (!values.startDate) {
        issue(['startDate'], 'Elegí la fecha de inicio');
      } else if (
        rules.phase === 'NOT_STARTED' &&
        values.startDate !== rules.saved?.startDate &&
        new Date(values.startDate) <= current
      ) {
        issue(['startDate'], 'La fecha de inicio ya pasó');
      }

      if (!values.endDate) {
        issue(['endDate'], 'Elegí la fecha de fin');
      } else if (values.startDate && values.endDate <= values.startDate) {
        issue(['endDate'], 'El fin tiene que ser posterior al inicio');
      } else if (
        rules.phase === 'IN_PROGRESS' &&
        rules.saved &&
        values.endDate < rules.saved.endDate
      ) {
        issue(
          ['endDate'],
          'El evento ya empezó: el fin solo se puede extender',
        );
      }

      // Con el evento en curso las tandas no se pueden cambiar ni se mandan.
      if (rules.phase === 'IN_PROGRESS') return;
      const eventEnd = values.endDate ? new Date(values.endDate) : null;
      values.batches.forEach((batch, index) => {
        const errors = getBatchWindowErrors(batch, {
          eventEnd,
          now: current,
          savedPublishAt:
            batch.id && savedStarts.has(batch.id)
              ? savedStarts.get(batch.id)
              : undefined,
        });
        if (errors.publishAt) {
          issue(['batches', index, 'publishAt'], errors.publishAt);
        }
        if (errors.closeAt) {
          issue(['batches', index, 'closeAt'], errors.closeAt);
        }
      });
    });
}

type EventSchema = ReturnType<typeof buildEventSchema>;
export type EventFormInput = z.input<EventSchema>;
export type EventFormOutput = z.output<EventSchema>;

// Límites de los selectores de fecha, en los dos sentidos: el inicio no pasa
// del fin elegido y el fin no queda antes del inicio (ni de ahora).
export function getDateLimits(
  values: FormDates,
  rules: EventDateRules,
  now: Date,
) {
  if (rules.phase === 'IN_PROGRESS') return { endMin: rules.saved?.endDate };
  const nowLocal = toDateTimeLocalInput(now.toISOString());
  return {
    startMin: nowLocal,
    startMax: values.endDate || undefined,
    endMin:
      values.startDate && values.startDate > nowLocal
        ? values.startDate
        : nowLocal,
  };
}

type SavedBatch = {
  id: string;
  name: string;
  isVisible: boolean;
  publishAt: string | null;
  closeAt: string | null;
  publishWhenPreviousSoldOut?: boolean;
  ticketTypes: {
    id: string;
    name: string;
    price: string | number;
    stock: number;
    sold?: number;
    reserved?: number;
  }[];
};

export type SavedEvent = {
  title: string;
  description: string;
  imageUrl: string | null;
  youtubeLink: string | null;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
  venueCity?: string | null;
  venuePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  ticketBatches?: SavedBatch[];
};

export function toEventFormInput(event: SavedEvent): EventFormInput {
  return {
    title: event.title,
    description: event.description,
    imageUrl: event.imageUrl ?? '',
    youtubeLink: event.youtubeLink ?? '',
    startDate: toDateTimeLocalInput(event.startDate),
    endDate: toDateTimeLocalInput(event.endDate),
    venueName: event.venueName ?? '',
    venueAddress: event.venueAddress ?? '',
    venueCity: event.venueCity ?? null,
    venuePlaceId: event.venuePlaceId ?? null,
    latitude: event.latitude ?? null,
    longitude: event.longitude ?? null,
    batches: (event.ticketBatches ?? []).map((batch) => ({
      id: batch.id,
      name: batch.name,
      isVisible: batch.isVisible,
      publishAt: batch.publishAt,
      closeAt: batch.closeAt,
      publishWhenPreviousSoldOut: batch.publishWhenPreviousSoldOut,
      ticketTypes: batch.ticketTypes.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        price: String(ticket.price),
        stock: String(ticket.stock),
        sold: ticket.sold,
        reserved: ticket.reserved,
      })),
    })),
  };
}

export function toEventPayload(values: EventFormOutput): EventFormValues {
  return {
    ...values,
    youtubeLink: values.youtubeLink || null,
    startDate: fromDateTimeLocalInput(values.startDate) ?? '',
    endDate: fromDateTimeLocalInput(values.endDate) ?? '',
  };
}
