export type EventPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'CLOSED';

type EventForPhase = {
  status: string;
  startDate: Date;
  endDate: Date;
  deletedAt: Date | null;
};

// Where an event stands for editing. An event whose end already passed is
// closed even before the cron marks it FINISHED, and a deleted one is closed
// for good.
export function getEventPhase(event: EventForPhase, now: Date): EventPhase {
  if (
    event.deletedAt !== null ||
    event.status === 'FINISHED' ||
    event.status === 'CANCELLED' ||
    now >= event.endDate
  ) {
    return 'CLOSED';
  }
  return now < event.startDate ? 'NOT_STARTED' : 'IN_PROGRESS';
}

const PHASE_ORDER: Record<EventPhase, number> = {
  IN_PROGRESS: 0,
  NOT_STARTED: 1,
  CLOSED: 2,
};

type PhasedEvent = { phase: EventPhase; startDate: Date; title: string };

// Events in progress first, then the upcoming ones (soonest first) and then
// the closed ones (latest first).
export function compareByPhase(a: PhasedEvent, b: PhasedEvent): number {
  return (
    PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
    (a.phase === 'CLOSED'
      ? b.startDate.getTime() - a.startDate.getTime()
      : a.startDate.getTime() - b.startDate.getTime()) ||
    a.title.localeCompare(b.title, 'es')
  );
}
