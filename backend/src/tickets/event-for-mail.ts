import { Event } from '@prisma/client';

// The job is serialized to JSON in the queue: the date travels as ISO text.
export function eventForMail(
  event: Pick<
    Event,
    'title' | 'startDate' | 'venueName' | 'venueAddress' | 'venueCity'
  >,
) {
  return {
    eventName: event.title,
    eventStartDate: event.startDate.toISOString(),
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    venueCity: event.venueCity,
  };
}
