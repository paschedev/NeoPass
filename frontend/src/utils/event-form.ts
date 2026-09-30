import { z } from 'zod';
import type { EventFormValues, EventPhase } from './event-edit';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from './format';

// Fechas del formulario en el formato de datetime-local ("2026-10-10T22:00").
type FormDates = { startDate: string; endDate: string };

export type EventDateRules = {
  // Al crear, el evento todavía no empezó.
  phase: Exclude<EventPhase, 'CLOSED'>;
  // Fechas guardadas del evento que se edita.
  saved?: FormDates;
};

const required = (message: string) => z.string().trim().min(1, message);

// Espejo de las reglas de fechas de backend/src/events/events.service.ts.
export function buildEventSchema(
  rules: EventDateRules,
  now: () => Date = () => new Date(),
) {
  return z
    .object({
      title: required('Poné el nombre del evento'),
      description: required('Contá de qué trata el evento'),
      imageUrl: required('Subí el flyer del evento'),
      youtubeLink: z.union([
        z.literal(''),
        z.url({ error: 'El link de YouTube no es válido' }),
      ]),
      startDate: z.string(),
      endDate: z.string(),
      venueName: required('Poné el nombre del lugar'),
      venueAddress: required('Poné la dirección'),
    })
    .superRefine((values, ctx) => {
      const issue = (path: keyof FormDates, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      if (!values.startDate) {
        issue('startDate', 'Elegí la fecha de inicio');
      } else if (
        rules.phase === 'NOT_STARTED' &&
        values.startDate !== rules.saved?.startDate &&
        new Date(values.startDate) <= now()
      ) {
        issue('startDate', 'La fecha de inicio ya pasó');
      }

      if (!values.endDate) {
        issue('endDate', 'Elegí la fecha de fin');
      } else if (values.startDate && values.endDate <= values.startDate) {
        issue('endDate', 'El fin tiene que ser posterior al inicio');
      } else if (
        rules.phase === 'IN_PROGRESS' &&
        rules.saved &&
        values.endDate < rules.saved.endDate
      ) {
        issue('endDate', 'El evento ya empezó: el fin solo se puede extender');
      }
    });
}

export type EventFormInput = z.infer<ReturnType<typeof buildEventSchema>>;

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

export type SavedEvent = {
  title: string;
  description: string;
  imageUrl: string | null;
  youtubeLink: string | null;
  startDate: string;
  endDate: string;
  venueName: string | null;
  venueAddress: string | null;
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
  };
}

export function toEventPayload(
  values: EventFormInput,
  batches: unknown[],
): EventFormValues {
  return {
    ...values,
    youtubeLink: values.youtubeLink || null,
    startDate: fromDateTimeLocalInput(values.startDate) ?? '',
    endDate: fromDateTimeLocalInput(values.endDate) ?? '',
    batches,
  };
}
