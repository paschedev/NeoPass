'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Plus, Ticket } from 'lucide-react';
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import BatchCard, { type TicketPreset } from '@/components/tandas/BatchCard';
import { apiFetch } from '@/utils/api';
import { getSimultaneousBatches } from '@/utils/batches';
import type { EventFormInput } from '@/utils/event-form';

// Tandas del evento dentro de EventForm (useFieldArray sobre `batches`).
export default function TandasManager({
  saved = [],
  eventId,
  locked = false,
}: {
  // Tandas guardadas del evento que se edita, para avisar solo lo que cambia.
  saved?: { id?: string; closeAt: string | null }[];
  eventId?: string;
  // Con el evento en curso no se agregan ni se editan tandas.
  locked?: boolean;
}) {
  const [presets, setPresets] = useState<TicketPreset[]>([]);
  const { control } = useFormContext<EventFormInput>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'batches',
    keyName: 'fieldKey',
  });
  const [batches, eventEnd] = useWatch({
    control,
    name: ['batches', 'endDate'],
  });

  useEffect(() => {
    apiFetch('/presets')
      .then((res) => (res.ok ? res.json() : []))
      .then(setPresets)
      .catch((error) => console.error(error));
  }, []);

  const simultaneous = eventEnd
    ? getSimultaneousBatches(batches, new Date(eventEnd), new Date())
    : [];
  const savedCloseAt = new Map(saved.map((batch) => [batch.id, batch.closeAt]));

  const addBatch = () =>
    append({
      tempId: `${Date.now()}`,
      name: `Tanda ${fields.length + 1}`,
      isVisible: false,
      publishAt: null,
      closeAt: null,
      publishWhenPreviousSoldOut: false,
      ticketTypes: [],
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Ticket className="text-pink-400 w-5 h-5" /> Tandas y Entradas
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            Administrá las tandas de venta, precios y disponibilidad.
          </p>
        </div>
        {!locked && (
          <button
            type="button"
            onClick={addBatch}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Nueva Tanda
          </button>
        )}
      </div>

      {simultaneous.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-sm text-amber-200 flex gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          <div>
            {simultaneous.map(([a, b]) => (
              <p key={`${a}-${b}`}>
                Las tandas &quot;{a}&quot; y &quot;{b}&quot; se venden al mismo
                tiempo.
              </p>
            ))}
            <p className="text-amber-200/70 mt-1">
              Está permitido; si no es lo que querés, ajustá las fechas de venta
              u ocultá una.
            </p>
          </div>
        </div>
      )}

      {fields.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-white/5">
          <Ticket className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-400">
            No hay tandas configuradas para este evento.
          </p>
          {!locked && (
            <button
              type="button"
              onClick={addBatch}
              className="text-pink-400 hover:text-pink-300 text-sm font-medium mt-2"
            >
              Creá tu primera tanda
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {fields.map((batch, index) => (
            <BatchCard
              key={batch.fieldKey}
              index={index}
              presets={presets}
              eventEnd={eventEnd}
              savedCloseAt={batch.id ? savedCloseAt.get(batch.id) : undefined}
              eventId={eventId}
              locked={locked}
              onRemove={() => remove(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
