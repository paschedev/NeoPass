// The camera keeps reading the QR in front of it: after showing a result, the
// same code is ignored for a while so the door doesn't flash "USADO" right away.
export const SAME_QR_COOLDOWN_MS = 10_000;

export interface LastScan {
  code: string;
  at: number;
}

export function isRepeatedScan(
  code: string,
  last: LastScan | null,
  now: number,
): boolean {
  return (
    last !== null && last.code === code && now - last.at < SAME_QR_COOLDOWN_MS
  );
}
