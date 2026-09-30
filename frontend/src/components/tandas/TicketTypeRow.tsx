'use client';

import { Trash2 } from 'lucide-react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { EventFormInput } from '@/utils/event-form';

// Una entrada de la tanda: nombre, precio y stock (se guardan como texto y el
// esquema los convierte a número).
export default function TicketTypeRow({
  batchIndex,
  index,
  sold,
  onRemove,
}: {
  batchIndex: number;
  index: number;
  sold?: number;
  onRemove: () => void;
}) {
  const { register, control } = useFormContext<EventFormInput>();
  const path = `batches.${batchIndex}.ticketTypes.${index}` as const;
  const { errors } = useFormState({ control, name: path });
  const ticketErrors = errors.batches?.[batchIndex]?.ticketTypes?.[index];
  const messages = [
    ticketErrors?.name?.message,
    ticketErrors?.price?.message,
    ticketErrors?.stock?.message,
  ].filter(Boolean);

  return (
    <div className="bg-black/40 p-3 rounded-lg border border-white/5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[150px]">
          <input
            type="text"
            placeholder="Nombre del Ticket"
            maxLength={30}
            {...register(`${path}.name`)}
            className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-indigo-500 text-sm text-white focus:outline-none px-1 py-1"
          />
        </div>
        <div className="w-24 relative">
          <span className="absolute left-2 top-1 text-neutral-500 text-sm">
            $
          </span>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Precio"
            aria-label="Precio"
            min={0}
            {...register(`${path}.price`)}
            className={`w-full bg-white/5 border ${ticketErrors?.price ? 'border-red-500' : 'border-white/10'} rounded px-2 pl-5 py-1 text-sm text-emerald-400 font-bold focus:outline-none focus:border-indigo-500`}
          />
        </div>
        <div className="w-24">
          <input
            type="number"
            inputMode="numeric"
            placeholder="Stock"
            aria-label="Stock"
            title="Capacidad de este ticket"
            min={1}
            {...register(`${path}.stock`)}
            className={`w-full bg-white/5 border ${ticketErrors?.stock ? 'border-red-500' : 'border-white/10'} rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-indigo-500`}
          />
        </div>
        {sold !== undefined && (
          <div className="text-xs text-neutral-400 bg-white/5 px-2 py-1 rounded">
            Vendidos: {sold}
          </div>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Eliminar entrada"
          className="w-7 h-7 flex items-center justify-center text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {messages.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-400">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
