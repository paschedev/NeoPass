export type EventPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'CLOSED';

type EventForPhase = { status: string; startDate: string; endDate: string };

// Espejo de backend/src/events/event-phase.ts: qué se puede editar según el
// momento del evento. Un evento cuyo fin ya pasó queda cerrado aunque el
// backend todavía no lo haya marcado como finalizado.
export function getEventPhase(event: EventForPhase, now: Date): EventPhase {
  if (
    event.status === 'FINISHED' ||
    event.status === 'CANCELLED' ||
    now >= new Date(event.endDate)
  ) {
    return 'CLOSED';
  }
  return now < new Date(event.startDate) ? 'NOT_STARTED' : 'IN_PROGRESS';
}

export function closedEventLabel(status: string): string {
  return status === 'CANCELLED' ? 'Evento cancelado' : 'Evento finalizado';
}

export type EventFormValues = {
  title: string;
  description: string;
  imageUrl: string;
  youtubeLink: string | null;
  startDate: string;
  endDate: string;
  venueName: string;
  venueAddress: string;
  batches: unknown[];
};

// Con el evento en curso, el inicio, el lugar y las tandas quedan fijos: no se
// mandan, y el backend rechaza cualquier cambio en ellos.
export function buildEventUpdate(values: EventFormValues, phase: EventPhase) {
  if (phase !== 'IN_PROGRESS') return values;
  const { title, description, imageUrl, youtubeLink, endDate } = values;
  return { title, description, imageUrl, youtubeLink, endDate };
}
