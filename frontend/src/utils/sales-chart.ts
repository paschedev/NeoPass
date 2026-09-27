export type ChartFilter = 'Esta semana' | 'Este mes' | 'Últimos 30 días';

export const CHART_FILTERS: ChartFilter[] = [
  'Esta semana',
  'Este mes',
  'Últimos 30 días',
];

// Ingresos por día que devuelve el backend (día de Argentina, "AAAA-MM-DD").
export interface RevenuePoint {
  date: string;
  revenue: number;
}

export interface ChartBar {
  label: string;
  subLabel: string;
  val: number;
  future: boolean;
}

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
const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

// Fecha local "AAAA-MM-DD". Con toISOString (UTC), desde las 21 h de Argentina
// las ventas de hoy caían en la barra de mañana.
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

export function buildChartSeries(
  points: RevenuePoint[],
  filter: ChartFilter,
  now: Date,
): ChartBar[] {
  const revenueOn = (date: Date) =>
    points.find((point) => point.date === dateKey(date))?.revenue ?? 0;

  if (filter === 'Esta semana') {
    return Array.from({ length: 7 }, (_, i) => {
      const date = daysBefore(now, 6 - i);
      return {
        label: WEEKDAYS[date.getDay()],
        subLabel: String(date.getDate()),
        val: revenueOn(date),
        future: false,
      };
    });
  }

  if (filter === 'Este mes') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(year, month, i + 1);
      const future = i + 1 > now.getDate();
      return {
        label: String(i + 1),
        subLabel: MONTHS[month],
        val: future ? 0 : revenueOn(date),
        future,
      };
    });
  }

  return Array.from({ length: 30 }, (_, i) => {
    const date = daysBefore(now, 29 - i);
    return {
      label: String(date.getDate()),
      subLabel: MONTHS[date.getMonth()],
      val: revenueOn(date),
      future: false,
    };
  });
}

// Tope "redondo" del eje Y: 150 → 200, 4.500 → 5.000.
export function getSmartMax(max: number): number {
  if (max === 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const fraction = max / magnitude;
  const niceFraction = [1, 2, 4, 5, 8].find((step) => fraction <= step) ?? 10;
  return niceFraction * magnitude;
}
