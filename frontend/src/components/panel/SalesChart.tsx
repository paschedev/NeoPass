'use client';

import { useMemo, useState, type PointerEvent } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import Anillo from '@/components/brand/Anillo';
import { useSvgId } from '@/components/brand/Isologo';
import { formatCompactNumber, formatCurrency } from '@/utils/format';
import {
  CHART_PERIODS,
  HISTORY_DAYS,
  dayLabel,
  fullDayLabel,
  getSmartMax,
  hasSales,
  labeledDays,
  smoothPath,
  summarizeSales,
  type ChartPeriod,
  type RevenuePoint,
} from '@/utils/sales-chart';

// El dibujo se arma en estas medidas y el SVG lo estira al ancho de la
// tarjeta; la línea mantiene su grosor (vector-effect).
const WIDTH = 600;
const HEIGHT = 220;
const TOP_GAP = 6;

const PERIOD_BUTTON = {
  on: 'bg-indigo-600 text-white',
  off: 'text-neutral-400 hover:text-white hover:bg-indigo-500/10',
};

// Ventas del Resumen como la cotización de un activo: lo vendido en el
// período, acumulado día a día, con el total grande y cuánto cambió contra el
// período anterior. Al pasar el mouse o el dedo muestra cada día en un lugar
// fijo, sin mover nada.
export default function SalesChart({ points }: { points: RevenuePoint[] }) {
  const [period, setPeriod] = useState<ChartPeriod>(7);
  const [active, setActive] = useState<number | null>(null);
  const gradient = useSvgId('ventas');

  const summary = useMemo(
    () => summarizeSales(points, period, new Date()),
    [points, period],
  );
  const { days, total, change } = summary;
  const max = getSmartMax(total);
  const last = days.length - 1;
  const coords = days.map((day, i): [number, number] => [
    (i * WIDTH) / last,
    HEIGHT - (day.cumulative / max) * (HEIGHT - TOP_GAP),
  ]);
  const line = smoothPath(coords);
  // Sin datos todavía (cargando) no se afirma nada; con datos y sin ventas,
  // el anillo ocupa el lugar del gráfico.
  const empty = points.length > 0 && !hasSales(points);

  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    setActive(Math.min(last, Math.max(0, Math.round(ratio * last))));
  };

  const activeDay = active === null ? null : days[active];
  const detail = activeDay
    ? `${fullDayLabel(activeDay.date)} · ${formatCurrency(activeDay.revenue)} ese día · ${formatCurrency(activeDay.cumulative)} acumulado`
    : 'Pasá el mouse o el dedo por el gráfico para ver cada día';

  return (
    <div className="lg:col-span-2 bg-neutral-900 border border-white/10 rounded-2xl p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-outfit text-xl font-bold">Ventas</h2>
          <p className="mt-3 font-outfit text-3xl md:text-4xl font-bold tracking-tight tabular-nums">
            {formatCurrency(total)}
          </p>
          <ChangeLine change={change} period={period} total={total} />
        </div>
        <div
          role="group"
          aria-label="Período del gráfico"
          className="inline-flex gap-1 rounded-xl border border-white/10 bg-neutral-950/60 p-1"
        >
          {CHART_PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={period === option}
              onClick={() => {
                setPeriod(option);
                setActive(null);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${period === option ? PERIOD_BUTTON.on : PERIOD_BUTTON.off}`}
            >
              {option} días
            </button>
          ))}
        </div>
      </div>

      <p
        aria-hidden="true"
        className={`mt-6 mb-3 h-5 truncate text-xs tabular-nums text-neutral-400 ${empty ? 'invisible' : ''}`}
      >
        {detail}
      </p>

      {empty ? (
        <div className="flex h-56 md:h-64 flex-col items-center justify-center text-center">
          <Anillo className="mb-5" />
          <p className="font-semibold text-white">
            Sin ventas en los últimos {HISTORY_DAYS} días
          </p>
          <p className="mt-1 text-sm text-neutral-400">
            Cuando se venda una entrada, el gráfico se arma solo.
          </p>
        </div>
      ) : (
        <div
          className="relative h-56 md:h-64 cursor-crosshair touch-pan-y select-none"
          onPointerMove={pointAt}
          onPointerDown={pointAt}
          onPointerLeave={() => setActive(null)}
        >
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full overflow-visible"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#6366f1" stopOpacity="0.38" />
                <stop offset="1" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.5, 1].map((fraction) => {
              const y = HEIGHT - fraction * (HEIGHT - TOP_GAP);
              return (
                <line
                  key={fraction}
                  x1="0"
                  x2={WIDTH}
                  y1={y}
                  y2={y}
                  stroke="rgba(255,255,255,0.07)"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {points.length > 0 && (
              <>
                <path
                  d={`${line}L${WIDTH} ${HEIGHT}L0 ${HEIGHT}Z`}
                  fill={`url(#${gradient})`}
                />
                <path
                  d={line}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </svg>
          {[1, 0.5].map((fraction) => (
            <span
              key={fraction}
              aria-hidden="true"
              className="pointer-events-none absolute left-0 text-[10px] text-neutral-500 tabular-nums"
              style={{ top: `calc(${(1 - fraction) * 100}% + 4px)` }}
            >
              {formatCompactNumber(max * fraction)}
            </span>
          ))}
          {active !== null && (
            <>
              <div
                className="pointer-events-none absolute inset-y-0 w-px bg-white/25"
                style={{ left: `${(active / last) * 100}%` }}
              />
              <div
                className="pointer-events-none absolute -ml-[5px] -mt-[5px] size-2.5 rounded-full bg-white ring-[3px] ring-indigo-500/50"
                style={{
                  left: `${(active / last) * 100}%`,
                  top: `${(coords[active][1] / HEIGHT) * 100}%`,
                }}
              />
            </>
          )}
        </div>
      )}

      <div
        aria-hidden="true"
        className={`relative mt-3 h-4 text-[10px] sm:text-xs text-neutral-500 tabular-nums ${empty ? 'invisible' : ''}`}
      >
        {labeledDays(period).map((i) => (
          <span
            key={i}
            className={`absolute top-0 whitespace-nowrap ${i === 0 ? '' : i === last ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${(i / last) * 100}%` }}
          >
            <AxisLabel text={dayLabel(days[i].date, period)} period={period} />
          </span>
        ))}
      </div>
    </div>
  );
}

// En la semana, el celular muestra solo el número: "Dom 15" y "Lun 16" no
// entran uno al lado del otro en 375 px.
function AxisLabel({ text, period }: { text: string; period: ChartPeriod }) {
  if (period !== 7) return text;
  const [weekday, day] = text.split(' ');
  return (
    <>
      <span className="hidden sm:inline">{weekday} </span>
      {day}
    </>
  );
}

// "↗ 23 % más que los 7 días anteriores". El lugar queda reservado aunque no
// haya con qué comparar, así el gráfico no salta al cambiar de período.
function ChangeLine({
  change,
  period,
  total,
}: {
  change: number | null;
  period: ChartPeriod;
  total: number;
}) {
  if (change === null) {
    return (
      <p className="mt-1 h-5 text-sm text-neutral-500">
        {total > 0 ? `Sin ventas en los ${period} días anteriores` : ''}
      </p>
    );
  }
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={`mt-1 flex h-5 items-center gap-1 text-sm font-medium tabular-nums ${up ? 'text-emerald-400' : 'text-red-400'}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {Math.abs(Math.round(change))} % {up ? 'más' : 'menos'} que los {period}{' '}
      días anteriores
    </p>
  );
}
