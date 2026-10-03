// Limits of what an organizer types in an event (the frontend mirrors them in
// utils/event-form.ts).
export const EVENT_LIMITS = {
  title: 60,
  description: 2000,
  venueName: 60,
  venueAddress: 120,
  batchName: 30,
  ticketTypeName: 30,
  youtubeLink: 200,
  stock: 100_000,
} as const;

export const YOUTUBE_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
];
