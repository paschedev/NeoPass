import { randomInt } from 'node:crypto';
import { EmailCode } from '@prisma/client';

export const EMAIL_CODE_TTL_MS = 15 * 60 * 1000;
export const EMAIL_CODE_ATTEMPTS = 5;
const COOLDOWN_MS = 60 * 1000;
const CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

type SendHistory = Pick<
  EmailCode,
  'email' | 'sentAt' | 'sentInWindow' | 'windowStartedAt'
>;

// Six digits, leading zeros included.
export function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

const windowOpen = (previous: SendHistory, now: Date) =>
  now.getTime() - previous.windowStartedAt.getTime() < HOUR_MS;

// Why another code to `email` can't be sent yet, or null: a minute between
// codes to the same email and at most 5 per hour, so nobody uses NeoPass to
// flood a mailbox. A code to another email (fixing a mistyped one right after
// signing up) doesn't wait the minute.
export function codeRequestError(
  previous: SendHistory | null,
  email: string,
  now: Date,
) {
  if (!previous) return null;

  const sameEmail = previous.email.toLowerCase() === email.toLowerCase();
  const wait = previous.sentAt.getTime() + COOLDOWN_MS - now.getTime();
  if (sameEmail && wait > 0) {
    return `Esperá ${Math.ceil(wait / 1000)} segundos para pedir otro código`;
  }
  if (windowOpen(previous, now) && previous.sentInWindow >= CODES_PER_HOUR) {
    return `Llegaste al máximo de ${CODES_PER_HOUR} códigos por hora. Probá de nuevo más tarde.`;
  }
  return null;
}

// The hourly counter once a new code goes out now.
export function nextSendWindow(previous: SendHistory | null, now: Date) {
  return previous && windowOpen(previous, now)
    ? {
        sentInWindow: previous.sentInWindow + 1,
        windowStartedAt: previous.windowStartedAt,
      }
    : { sentInWindow: 1, windowStartedAt: now };
}

// After a wrong guess, with the attempts used so far.
export function wrongCodeMessage(attempts: number) {
  const left = EMAIL_CODE_ATTEMPTS - attempts;
  if (left <= 0) return 'El código no es correcto. Pedí uno nuevo.';
  return left === 1
    ? 'El código no es correcto. Te queda 1 intento.'
    : `El código no es correcto. Te quedan ${left} intentos.`;
}
