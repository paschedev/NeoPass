// The start of the event is the show: doors usually open earlier, so tickets
// can be scanned from this long before it. The check stops a ticket from
// being used on another day by mistake.
export const CHECK_IN_OPENS_BEFORE_START_MS = 2 * 60 * 60 * 1000;

export function checkInOpensAt(startDate: Date): Date {
  return new Date(startDate.getTime() - CHECK_IN_OPENS_BEFORE_START_MS);
}
