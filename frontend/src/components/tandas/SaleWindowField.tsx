'use client';

import { Controller, useFormContext } from 'react-hook-form';
import type { EventFormInput } from '@/utils/event-form';
import { fromDateTimeLocalInput, toDateTimeLocalInput } from '@/utils/format';

const TOGGLE_COLORS = {
  indigo: { on: 'bg-indigo-500', focus: 'focus:border-indigo-500' },
  pink: { on: 'bg-pink-500', focus: 'focus:border-pink-500' },
};

// "Venta desde" / "Venta hasta" de una tanda: un switch que activa la fecha
// (con una sugerida) y el selector. La fecha se guarda en ISO.
export default function SaleWindowField({
  batchIndex,
  field,
  label,
  inputLabel,
  color,
  suggest,
  min,
  max,
  warning,
}: {
  batchIndex: number;
  field: 'publishAt' | 'closeAt';
  label: string;
  inputLabel: string;
  color: keyof typeof TOGGLE_COLORS;
  suggest: () => string;
  min?: string;
  max?: string;
  warning?: string;
}) {
  const { control, trigger } = useFormContext<EventFormInput>();
  const colors = TOGGLE_COLORS[color];
  // Desde y hasta se validan uno contra el otro.
  const revalidateWindow = () =>
    void trigger([
      `batches.${batchIndex}.publishAt`,
      `batches.${batchIndex}.closeAt`,
    ]);

  return (
    <Controller
      control={control}
      name={`batches.${batchIndex}.${field}`}
      render={({ field: { value, onChange }, fieldState: { error } }) => (
        <div>
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={!!value}
                onChange={(e) => {
                  onChange(e.target.checked ? suggest() : null);
                  revalidateWindow();
                }}
              />
              <div
                className={`block w-10 h-6 rounded-full transition-colors ${value ? colors.on : 'bg-white/10'}`}
              ></div>
              <div
                className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${value ? 'transform translate-x-4' : ''}`}
              ></div>
            </div>
            <span className="text-xs text-neutral-400 font-medium uppercase">
              {label}
            </span>
          </label>
          {value && (
            <input
              type="datetime-local"
              aria-label={inputLabel}
              min={min}
              max={max}
              value={toDateTimeLocalInput(value)}
              onChange={(e) => {
                onChange(fromDateTimeLocalInput(e.target.value));
                revalidateWindow();
              }}
              className={`w-full bg-white/5 border ${error ? 'border-red-500' : 'border-white/10'} rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none ${colors.focus} [color-scheme:dark]`}
            />
          )}
          {error ? (
            <p className="text-red-400 text-xs mt-1">{error.message}</p>
          ) : (
            warning && <p className="text-amber-400 text-xs mt-1">{warning}</p>
          )}
        </div>
      )}
    />
  );
}
