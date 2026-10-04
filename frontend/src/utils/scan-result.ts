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

// Un QR free que se usó después de su hora límite.
export function entryDeadlinePassedLabel(
  validUntil: string,
  now = new Date(),
): string {
  return `Podía entrar hasta ${whenLabel(validUntil, now)}`;
}
