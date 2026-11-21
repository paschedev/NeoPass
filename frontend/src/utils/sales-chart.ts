// El gráfico de Ventas del Resumen: lo vendido en los últimos 7 o 30 días,
// acumulado día a día, y la comparación con el período anterior.

export type ChartPeriod = 7 | 30;

export const CHART_PERIODS: ChartPeriod[] = [7, 30];

// Días que manda el servidor: dos períodos de 30, para poder comparar.
export const HISTORY_DAYS = 60;

// Ingresos por día que devuelve el backend (día de Argentina, "AAAA-MM-DD").
export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface SalesDay {
  date: Date;
  revenue: number;
  // Lo vendido desde el primer día del período hasta este, inclusive.
  cumulative: number;
}

export interface SalesSummary {
  days: SalesDay[];
  total: number;
  previousTotal: number;
  // Variación contra el período anterior, en %. Sin ventas en el anterior no
  // hay contra qué comparar: null.
  change: number | null;
}

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Fecha local "AAAA-MM-DD". Con toISOString (UTC), desde las 21 h de Argentina
// las ventas de hoy caían en el día de mañana.
const dateKey = (date: Date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const daysBefore = (now: Date, days: number) => {
  const date = new Date(now);
  date.setDate(now.getDate() - days);
  return date;
};

// Las sumas van en centavos enteros: con decimales de JS, tres ventas de
// $1.500,15 no dan $4.500,45 justo.
const toCents = (amount: number) => Math.round(amount * 100);

export function summarizeSales(
  points: RevenuePoint[],
  period: ChartPeriod,
  now: Date,
): SalesSummary {
  const revenueByDay = new Map(
    points.map((point) => [point.date, toCents(point.revenue)]),
  );
  const centsOn = (date: Date) => revenueByDay.get(dateKey(date)) ?? 0;

  let cumulative = 0;
  const days = Array.from({ length: period }, (_, i) => {
    const date = daysBefore(now, period - 1 - i);
    const cents = centsOn(date);
    cumulative += cents;
    return { date, revenue: cents / 100, cumulative: cumulative / 100 };
  });

  let previous = 0;
  for (let i = period; i < period * 2; i++)
    previous += centsOn(daysBefore(now, i));

  return {
    days,
    total: cumulative / 100,
    previousTotal: previous / 100,
    change: previous > 0 ? ((cumulative - previous) / previous) * 100 : null,
  };
}

// Algo vendido en todo lo que mandó el servidor.
export const hasSales = (points: RevenuePoint[]) =>
  points.some((point) => point.revenue > 0);

// "Sáb 26" en la semana; "26 sep" en el mes.
export function dayLabel(date: Date, period: ChartPeriod): string {
  return period === 7
    ? `${WEEKDAYS[date.getDay()]} ${date.getDate()}`
    : `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// "Sáb 26 sep", para el detalle de un día.
export const fullDayLabel = (date: Date) =>
  `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;

// Los días con etiqueta abajo del gráfico: todos en la semana; en el mes, uno
// cada 6 y el último, sin que el anterior quede pegado a él.
export function labeledDays(period: ChartPeriod): number[] {
  if (period === 7) return Array.from({ length: 7 }, (_, i) => i);
  const last = period - 1;
  const every = Array.from({ length: period }, (_, i) => i).filter(
    (i) => i % 6 === 0 && last - i >= 3,
  );
  return [...every, last];
}

// Una curva suave por los puntos que no se pasa de ellos: los controles quedan
// entre los dos valores de cada tramo, así lo acumulado nunca parece bajar.
export function smoothPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  const round = (value: number) => Math.round(value * 10) / 10;
  let path = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const low = Math.min(p1[1], p2[1]);
    const high = Math.max(p1[1], p2[1]);
    const clamp = (value: number) => Math.min(high, Math.max(low, value));
    const c1 = [
      p1[0] + (p2[0] - p0[0]) / 6,
      clamp(p1[1] + (p2[1] - p0[1]) / 6),
    ];
    const c2 = [
      p2[0] - (p3[0] - p1[0]) / 6,
      clamp(p2[1] - (p3[1] - p1[1]) / 6),
    ];
    path += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return path;
}

// Tope "redondo" del eje Y: 150 → 200, 4.500 → 5.000.
export function getSmartMax(max: number): number {
  if (max === 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const fraction = max / magnitude;
  const niceFraction = [1, 2, 4, 5, 8].find((step) => fraction <= step) ?? 10;
  return niceFraction * magnitude;
}
