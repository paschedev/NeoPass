export type EventPhase = 'NOT_STARTED' | 'IN_PROGRESS' | 'CLOSED';

type EventForPhase = { status: string; startDate: Date; endDate: Date };

// Where an event stands for editing. An event whose end already passed is
// closed even before the cron marks it FINISHED.
export function getEventPhase(event: EventForPhase, now: Date): EventPhase {
  if (
    event.status === 'FINISHED' ||
    event.status === 'CANCELLED' ||
    now >= event.endDate
  ) {
    return 'CLOSED';
  }
  return now < event.startDate ? 'NOT_STARTED' : 'IN_PROGRESS';
}
