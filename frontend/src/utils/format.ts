const MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Pesos: sin decimales si es entero y con dos si tiene centavos. Acepta los
// Decimal de Prisma, que llegan como string.
export function formatCurrency(value: number | string): string {
  const amount = Number(value);
  const decimals = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  })}`;
}

export function formatRelativeDate(value: string, now = new Date()): string {
  const date = new Date(value);
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const minutes = Math.floor(elapsed / MINUTE);
  const hours = Math.floor(elapsed / HOUR);
  const days = Math.floor(elapsed / DAY);

  if (minutes === 0) return 'Justo ahora';
  if (hours === 0) return `Hace ${minutes} min`;
  if (days === 0) return hours === 1 ? 'Hace 1 hora' : `Hace ${hours} horas`;
  if (days === 1) return 'Ayer';
  if (days <= 7) return `Hace ${days} días`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Para los ejes de los gráficos: 1.500 → "1,5k", 2.000.000 → "2M".
export function formatCompactNumber(value: number): string {
  const compact = (n: number, suffix: string) =>
    n.toFixed(1).replace(/\.0$/, '').replace('.', ',') + suffix;
  if (value >= 1_000_000) return compact(value / 1_000_000, 'M');
  if (value >= 1000) return compact(value / 1000, 'k');
  return Math.round(value).toString();
}

// Un <input type="datetime-local"> trabaja en la hora local del navegador,
// sin zona horaria: "2026-10-03T18:30".
export function toDateTimeLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * MINUTE;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function fromDateTimeLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}
