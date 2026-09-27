'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import CustomSelect from '@/components/CustomSelect';
import { formatCompactNumber, formatCurrency } from '@/utils/format';
import {
  CHART_FILTERS,
  buildChartSeries,
  getSmartMax,
  type ChartFilter,
  type RevenuePoint,
} from '@/utils/sales-chart';

const Y_TICKS = [1, 0.8, 0.6, 0.4, 0.2, 0];

export default function SalesChart({ points }: { points: RevenuePoint[] }) {
  const [filter, setFilter] = useState<ChartFilter>('Esta semana');
  const series = useMemo(
    () => buildChartSeries(points, filter, new Date()),
    [points, filter],
  );
  const maxVal = getSmartMax(Math.max(...series.map((bar) => bar.val), 100));

  return (
    <div className="lg:col-span-2 bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
      <div className="hidden md:block absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="flex items-center justify-between mb-8 relative z-30">
        <h2 className="font-outfit text-xl font-bold">Ventas</h2>
        <CustomSelect
          value={filter}
          onChange={(value) => setFilter(value as ChartFilter)}
          options={CHART_FILTERS.map((option) => ({
            value: option,
            label: option,
          }))}
          className="w-44"
        />
      </div>

      <div className="h-96 relative flex items-end justify-between gap-0.5 sm:gap-2 z-10 pt-8 ml-4 sm:ml-6">
        {/* Y-Axis Grid Lines */}
        <div className="absolute inset-0 flex flex-col justify-between pt-8 pb-0 pointer-events-none z-0">
          {Y_TICKS.map((tick, i) => (
            <div key={i} className="flex items-center w-full relative">
              <span className="absolute -left-2 -translate-x-full text-[10px] text-neutral-500 font-medium">
                {formatCompactNumber(maxVal * tick)}
              </span>
              <div className="w-full h-[1px] bg-white/[0.03]"></div>
            </div>
          ))}
        </div>

        {/* Bars */}
        {series.map((bar, i) => (
          <div
            key={i}
            className={`w-full h-full bg-white/5 rounded-t-lg group relative flex items-end transition-all z-10 ${!bar.future && 'hover:bg-white/10 cursor-crosshair'}`}
          >
            <motion.div
              initial={{ height: '0%' }}
              animate={{ height: `${(bar.val / maxVal) * 100}%` }}
              transition={{ duration: 1, delay: i * 0.02, ease: 'easeOut' }}
              className={`w-full ${bar.future ? 'bg-transparent' : 'bg-gradient-to-t from-indigo-600 to-purple-400 opacity-80 group-hover:opacity-100'} rounded-t-lg transition-opacity relative`}
            >
              {!bar.future && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] sm:text-xs font-bold px-1 sm:px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  {formatCurrency(bar.val)}
                </div>
              )}
            </motion.div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-4 text-[10px] sm:text-xs font-medium text-neutral-500 relative z-10 overflow-visible ml-4 sm:ml-6">
        {series.map((bar, i) => {
          const showLabel =
            filter === 'Esta semana' || i % Math.ceil(series.length / 7) === 0;
          return (
            <div key={i} className="flex-1 flex justify-center relative">
              {showLabel && (
                <div className="absolute top-0 flex flex-col items-center">
                  <span className="whitespace-nowrap">{bar.label}</span>
                  {bar.subLabel && (
                    <span className="text-[8px] sm:text-[10px] text-neutral-600 font-normal">
                      {bar.subLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
