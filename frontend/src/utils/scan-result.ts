import { formatWeekdayDateTime } from './format';

// Espejo de backend/src/tickets/check-in-window.ts.
export const CHECK_IN_OPENS_HOURS_BEFORE_START = 2;

export type ScanTone = 'success' | 'warning' | 'error';

// Verde: pasa. Amarillo: la entrada es real pero ahora no entra (ya usada o
// todavía no abrió el ingreso). Rojo: no sirve.
export function scanTone(status?: string): ScanTone {
  if (status === 'VALID') return 'success';
  if (status === 'USED' || status === 'NOT_STARTED') return 'warning';
  return 'error';
}

// "Se puede escanear desde las 21:30", o con el día si no es hoy.
export function checkInOpensLabel(opensAt: string, now = new Date()): string {
  const opens = new Date(opensAt);
  if (opens.toDateString() !== now.toDateString()) {
    return `Se puede escanear desde el ${formatWeekdayDateTime(opensAt)}`;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Se puede escanear desde las ${pad(opens.getHours())}:${pad(opens.getMinutes())}`;
}
