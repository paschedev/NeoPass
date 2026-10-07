import { formatWeekdayDateTime } from './format';

// Espejo de backend/src/tickets/check-in-window.ts.
export const CHECK_IN_OPENS_HOURS_BEFORE_START = 2;

export type ScanTone = 'success' | 'warning' | 'error';

// Verde: pasa. Amarillo: la entrada es real pero ahora no entra (ya usada o
// todavía no abrió el ingreso). Rojo: no sirve, o no se pudo validar.
export function scanTone(status?: string): ScanTone {
  if (status === 'VALID') return 'success';
  if (status === 'USED' || status === 'NOT_STARTED') return 'warning';
  return 'error';
}

// El verde se va solo para que la fila avance; el amarillo y el rojo esperan
// a que el scanner los cierre, porque a esa persona hay que atenderla.
export const SUCCESS_RESULT_MS = 2_000;

export function closesByItself(tone: ScanTone): boolean {
  return tone === 'success';
}

export interface ScanHistoryEntry {
  id: number;
  at: string;
  tone: ScanTone;
  message: string;
  detail?: string;
}

const HISTORY_SIZE = 5;

export function addToScanHistory(
  history: ScanHistoryEntry[],
  entry: ScanHistoryEntry,
): ScanHistoryEntry[] {
  return [entry, ...history].slice(0, HISTORY_SIZE);
}

// "las 21:30" si es hoy, o "el sáb, 10 oct, 21:30".
function whenLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  if (date.toDateString() !== now.toDateString()) {
    return `el ${formatWeekdayDateTime(iso)}`;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `las ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function checkInOpensLabel(opensAt: string, now = new Date()): string {
  return `Se puede escanear desde ${whenLabel(opensAt, now)}`;
}

// "hace 8 s" o "hace 6 min"; nada si pasó más de una hora.
function agoLabel(iso: string, now: Date): string | null {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return `hace ${seconds} s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  return null;
}

// Una entrada ya usada: cuándo entró y quién la escaneó, para distinguir el
// propio re-escaneo de una captura compartida.
export function usedDetailLabel(
  {
    usedAt,
    usedBy,
    usedByYou,
  }: { usedAt?: string; usedBy?: string; usedByYou?: boolean },
  now = new Date(),
): string | null {
  if (!usedAt) return null;
  const today = new Date(usedAt).toDateString() === now.toDateString();
  const ago = agoLabel(usedAt, now);
  const when = `Entró ${today ? 'a ' : ''}${whenLabel(usedAt, now)}${ago ? ` (${ago})` : ''}`;
  if (usedByYou) return `${when} · lo escaneaste vos`;
  return usedBy ? `${when} · lo escaneó ${usedBy}` : when;
}

// Un QR free que se usó después de su hora límite.
export function entryDeadlinePassedLabel(
  validUntil: string,
  now = new Date(),
): string {
  return `Podía entrar hasta ${whenLabel(validUntil, now)}`;
}
