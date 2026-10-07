// The camera reads the codes in front of it about twice a second. A code that
// was already sent is not sent again while it stays in view: it has to be out
// of the camera this long first. Then it is a new showing and it is checked
// again (the server answers "YA INGRESÓ" with when and by whom).
export const SAME_QR_GAP_MS = 2_000;

// Codes already sent to the server, with the last time the camera saw them.
export type SeenCodes = ReadonlyMap<string, number>;

// Which code to check now, if any. `busy` while a check is running or its
// result is on screen: nothing is checked behind a result, and a code that
// shows up meanwhile is not marked as seen, so it is checked once the result
// closes.
export function nextScan(
  codes: string[],
  seen: SeenCodes,
  now: number,
  busy: boolean,
): { code: string | null; seen: Map<string, number> } {
  const inView = new Map(
    [...seen].filter(([, lastSeen]) => now - lastSeen < SAME_QR_GAP_MS),
  );
  const code = busy ? undefined : codes.find((c) => !inView.has(c));
  for (const c of codes) {
    if (inView.has(c) || c === code) inView.set(c, now);
  }
  return { code: code ?? null, seen: inView };
}
