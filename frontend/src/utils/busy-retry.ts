// Answers that mean "too many people right now", not "it failed": the limit
// per minute (429) and a saturated database (503).
export function isBusyStatus(status: number): boolean {
  return status === 429 || status === 503;
}

const FIRST_WAIT_MS = 5_000;
const LONGEST_WAIT_MS = 60_000;
const JITTER_MS = 1_000;

// How long to wait before trying a load again: what the server says
// (Retry-After, in seconds) or, without that, longer after each failure. Plus
// up to a second at random, so everyone who got the notice does not come back
// at the same instant.
export function retryDelayMs(
  failures: number,
  retryAfter: string | null,
  random: () => number = Math.random,
): number {
  const seconds = Number(retryAfter);
  const wait =
    retryAfter && Number.isFinite(seconds) && seconds > 0
      ? seconds * 1000
      : FIRST_WAIT_MS * 2 ** (failures - 1);
  return Math.min(wait, LONGEST_WAIT_MS) + Math.floor(random() * JITTER_MS);
}

// "0:07": the same width every second, so the line never jumps.
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
