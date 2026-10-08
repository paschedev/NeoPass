'use client';

import { useId } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatCurrency } from '@/utils/format';
import {
  formatPercentage,
  serviceFeeExample,
  serviceFeeSchema,
  type ServiceFeeInput,
  type ServiceFeeOutput,
} from '@/utils/service-fee';
import toast from '@/utils/toast';
import type { AdminEvent } from './types';

const FIELD =
  'w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500';

function ServiceFeeForm({
  event,
  titleId,
  onClose,
  onSaved,
}: {
  event: AdminEvent;
  titleId: string;
  onClose: () => void;
  onSaved: (percentage: string) => void;
}) {
  const inputId = useId();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFeeInput, unknown, ServiceFeeOutput>({
    resolver: zodResolver(serviceFeeSchema),
    defaultValues: { percentage: '' },
  });
  const text = useWatch({ control, name: 'percentage' });
  const typed = serviceFeeSchema.safeParse({ percentage: text });
  // Solo con un valor válido: cuánto pagaría quien compra.
  const preview = typed.success
    ? {
        percentage: typed.data.percentage,
        ...serviceFeeExample(typed.data.percentage),
      }
    : null;

  const save = async ({ percentage }: ServiceFeeOutput) => {
    try {
      const response = await apiFetch(
        `/admin/events/${event.id}/service-fee`,
        { method: 'PATCH', body: JSON.stringify({ percentage }) },
      );
      const body = await response.json();
      if (!response.ok) {
        toast.error(getApiErrorMessage(body, 'No se pudo cambiar el cargo'));
        return;
      }
      toast.success('Cargo actualizado');
      onSaved((body as Pick<AdminEvent, 'neoPassFeePercentage'>).neoPassFeePercentage);
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <form onSubmit={handleSubmit(save)} noValidate className="space-y-5">
      <div>
        <h2 id={titleId} className="text-xl font-bold break-words">
          Cargo de servicio de {event.title}
        </h2>
        <p className="text-sm text-neutral-400 mt-2">
          Hoy es de {formatPercentage(event.neoPassFeePercentage)}. Vale desde
          la próxima compra: las que ya empezaron conservan su cargo.
        </p>
      </div>
      <div>
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-neutral-400 mb-1 block"
        >
          Cargo de servicio (%)
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Ej: 12,5"
          className={FIELD}
          {...register('percentage')}
        />
        {errors.percentage && (
          <p className="text-red-400 text-xs mt-1">
            {errors.percentage.message}
          </p>
        )}
        {preview && (
          <p className="text-sm text-neutral-300 mt-3">
            Pasa de {formatPercentage(event.neoPassFeePercentage)} a{' '}
            {formatPercentage(preview.percentage)}: una entrada de{' '}
            {formatCurrency(preview.price)} le cuesta{' '}
            {formatCurrency(preview.total)} a quien compra.
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}

// Cambia el cargo de servicio de un evento. Lo decide NeoPass: el backend
// solo lo acepta de la cuenta ADMIN.
export default function ServiceFeeModal({
  event,
  onClose,
  onSaved,
}: {
  event: AdminEvent | null;
  onClose: () => void;
  onSaved: (percentage: string) => void;
}) {
  const titleId = useId();
  return (
    <Modal
      open={event !== null}
      onClose={onClose}
      labelledBy={titleId}
      className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-md shadow-2xl p-6"
    >
      {event && (
        <ServiceFeeForm
          key={event.id}
          event={event}
          titleId={titleId}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
