'use client';

import { useState } from 'react';
import { Ticket, Trash2 } from 'lucide-react';
import toast from '@/utils/toast';
import {
  Controller,
  useFieldArray,
  useFormContext,
  useWatch,
} from 'react-hook-form';
import CustomSelect from '@/components/CustomSelect';
import {
  BATCH_STATUS_BADGES,
  defaultSaleEnd,
  defaultSaleStart,
  getBatchSaleStatus,
  saleEndsOnSave,
} from '@/utils/batches';
import type { EventFormInput } from '@/utils/event-form';
import { toDateTimeLocalInput } from '@/utils/format';
import BatchSaleActions from './BatchSaleActions';
import SaleWindowField from './SaleWindowField';
import TicketTypeRow from './TicketTypeRow';

export type TicketPreset = { id: string; name: string };

const hasTicketsTaken = (ticket: { sold?: number; reserved?: number }) =>
  (ticket.sold ?? 0) + (ticket.reserved ?? 0) > 0;

export default function BatchCard({
  index,
  presets,
  eventEnd,
  savedCloseAt,
  eventId,
  locked,
  onRemove,
}: {
  index: number;
  presets: TicketPreset[];
  // Fin del evento elegido, en formato datetime-local ('' si todavía no hay).
  eventEnd: string;
  savedCloseAt?: string | null;
  // Evento guardado al que pertenece la tanda (sin él no hay acciones de venta).
  eventId?: string;
  // Con el evento en curso la tanda no se edita; solo quedan sus acciones.
  locked: boolean;
  onRemove: () => void;
}) {
  const {
    control,
    register,
    formState: { errors },
  } = useFormContext<EventFormInput>();
  // Fin de venta guardado en el servidor: cambia al finalizar o reabrir la venta.
  const [storedCloseAt, setStoredCloseAt] = useState(savedCloseAt);
  const { fields, append, remove } = useFieldArray({
    control,
    name: `batches.${index}.ticketTypes`,
    keyName: 'fieldKey',
  });
  const batch = useWatch({ control, name: `batches.${index}` });

  const now = new Date();
  const status = getBatchSaleStatus(
    {
      ...batch,
      ticketTypes: batch.ticketTypes.map((ticket) => ({
        ...ticket,
        stock: Number(ticket.stock),
      })),
    },
    now,
  );
  const badge = BATCH_STATUS_BADGES[status];
  const publishAtLocal = toDateTimeLocalInput(batch.publishAt);
  const closeAtLocal = toDateTimeLocalInput(batch.closeAt);

  const addTicketType = (preset?: TicketPreset) =>
    append({
      tempId: `${Date.now()}`,
      name: preset?.name ?? 'Nueva entrada',
      price: '',
      stock: '100',
    });

  const removeTicketType = (ticketIndex: number) => {
    if (hasTicketsTaken(batch.ticketTypes[ticketIndex])) {
      toast.error(
        'No podés eliminar una entrada con ventas. Bajá su stock a lo ya vendido.',
      );
      return;
    }
    remove(ticketIndex);
  };

  const removeBatch = () => {
    if (batch.ticketTypes.some(hasTicketsTaken)) {
      toast.error(
        'No podés eliminar una tanda que ya tiene ventas. Ocultala o finalizá su venta.',
      );
      return;
    }
    onRemove();
  };

  return (
    <section
      aria-label={`Tanda ${index + 1}`}
      className="bg-black/50 border border-white/10 rounded-2xl p-6 relative"
    >
      <fieldset disabled={locked} className="min-w-0 disabled:opacity-60">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
          <div className="flex-1 w-full md:w-auto md:min-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <label
                htmlFor={`batch-${index}-name`}
                className="text-xs text-neutral-500 uppercase font-bold"
              >
                Nombre de la tanda
              </label>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
              >
                {badge.label}
              </span>
            </div>
            <input
              id={`batch-${index}-name`}
              type="text"
              {...register(`batches.${index}.name`)}
              className="w-full bg-transparent border-b border-white/20 focus:border-pink-500 text-lg font-bold text-white focus:outline-none px-0 py-1"
            />
            {errors.batches?.[index]?.name && (
              <p className="text-red-400 text-xs mt-1">
                {errors.batches[index].name.message}
              </p>
            )}
          </div>

          <div className="w-full md:w-auto">
            <label className="text-xs text-neutral-500 uppercase font-bold mb-1 block">
              Visibilidad
            </label>
            <Controller
              control={control}
              name={`batches.${index}.isVisible`}
              render={({ field }) => (
                <CustomSelect
                  value={field.value ? 'visible' : 'hidden'}
                  onChange={(val) => field.onChange(val === 'visible')}
                  options={[
                    { value: 'visible', label: 'Visible' },
                    { value: 'hidden', label: 'Oculta' },
                  ]}
                />
              )}
            />
          </div>

          <div className="w-full md:w-auto flex flex-col gap-3">
            <SaleWindowField
              batchIndex={index}
              field="publishAt"
              label="Venta desde"
              inputLabel="Fecha de inicio de venta"
              color="indigo"
              suggest={() => defaultSaleStart(new Date())}
              max={closeAtLocal || eventEnd || undefined}
            />
            <SaleWindowField
              batchIndex={index}
              field="closeAt"
              label="Venta hasta"
              inputLabel="Fecha de fin de venta"
              color="pink"
              suggest={() => defaultSaleEnd(batch.publishAt, new Date())}
              min={publishAtLocal || undefined}
              max={eventEnd || undefined}
              warning={
                saleEndsOnSave(batch, storedCloseAt, now)
                  ? 'Ya pasó: la venta de la tanda termina al guardar.'
                  : undefined
              }
            />
          </div>

          <button
            type="button"
            onClick={removeBatch}
            className="absolute top-4 right-4 md:static md:top-auto md:right-auto w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors md:mt-6"
            title="Eliminar tanda"
            aria-label="Eliminar tanda"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white/5 border border-white/5 rounded-xl p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-neutral-400" /> Tipos de Entradas
            </h3>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <div className="w-full sm:w-48 sm:flex-none">
                <CustomSelect
                  value=""
                  onChange={(presetId) => {
                    const preset = presets.find(({ id }) => id === presetId);
                    if (preset) addTicketType(preset);
                  }}
                  placeholder="+ Cargar Plantilla"
                  options={presets.map((p) => ({ value: p.id, label: p.name }))}
                  className="w-full h-full"
                  buttonClassName="w-full h-full min-h-[38px] flex items-center justify-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border-0 rounded-xl text-xs text-white font-medium transition-colors"
                />
              </div>

              <button
                type="button"
                onClick={() => addTicketType()}
                className="w-full sm:w-auto min-h-[38px] flex items-center justify-center bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap"
              >
                + Ticket Nuevo
              </button>
            </div>
          </div>

          {fields.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center py-4">
              Agregá entradas a esta tanda
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((ticket, ticketIndex) => (
                <TicketTypeRow
                  key={ticket.fieldKey}
                  batchIndex={index}
                  index={ticketIndex}
                  sold={ticket.sold}
                  onRemove={() => removeTicketType(ticketIndex)}
                />
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {batch.id && eventId && (
        <BatchSaleActions
          eventId={eventId}
          batchIndex={index}
          eventInProgress={locked}
          onApplied={({ closeAt }) => setStoredCloseAt(closeAt)}
        />
      )}
    </section>
  );
}
