'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  entryDeadlineOptions,
  freeTicketsSchema,
  MAX_FREE_TICKETS_PER_GRANT,
  type FreeTicketsFormInput,
  type FreeTicketsFormOutput,
} from '@/utils/free-tickets';

const FIELD =
  'w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500';
const LABEL = 'text-sm font-medium text-neutral-400 mb-1 block';

const QUANTITIES = Array.from(
  { length: MAX_FREE_TICKETS_PER_GRANT },
  (_, index) => String(index + 1),
);

// Entradas gratis a un correo: un tipo del evento, de 1 a 10, con una hora
// límite de ingreso opcional.
export default function SendFreeTicketsForm({
  event,
  ticketTypes,
  titleId,
  onSubmit,
  onCancel,
}: {
  event: { startDate: string; endDate: string };
  ticketTypes: { id: string; label: string }[];
  titleId: string;
  onSubmit: (grant: FreeTicketsFormOutput) => Promise<void>;
  onCancel: () => void;
}) {
  // Se calculan al abrir el formulario: no ofrece horarios que ya pasaron.
  const [deadlines] = useState(() => entryDeadlineOptions(event, new Date()));
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FreeTicketsFormInput, unknown, FreeTicketsFormOutput>({
    resolver: zodResolver(freeTicketsSchema),
    defaultValues: {
      ticketTypeId: ticketTypes[0]?.id ?? '',
      quantity: '1',
      email: '',
      name: '',
      validUntil: '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <h2 id={titleId} className="text-xl font-bold">
          Enviar QR free
        </h2>
        <p className="text-sm text-neutral-400 mt-2">
          Llegan por mail, un QR por persona. No descuentan entradas a la venta.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label htmlFor="free-type" className={LABEL}>
            Tipo de entrada
          </label>
          <select
            id="free-type"
            className={FIELD}
            {...register('ticketTypeId')}
          >
            {ticketTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="free-quantity" className={LABEL}>
            Cantidad
          </label>
          <select
            id="free-quantity"
            className={FIELD}
            {...register('quantity')}
          >
            {QUANTITIES.map((quantity) => (
              <option key={quantity} value={quantity}>
                {quantity}
              </option>
            ))}
          </select>
        </div>
      </div>
      {errors.ticketTypeId && (
        <p className="text-red-400 text-xs -mt-3">
          {errors.ticketTypeId.message}
        </p>
      )}
      <div>
        <label htmlFor="free-email" className={LABEL}>
          Correo
        </label>
        <input
          id="free-email"
          type="email"
          autoComplete="off"
          placeholder="nombre@correo.com"
          className={FIELD}
          {...register('email')}
        />
        {errors.email && (
          <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="free-name" className={LABEL}>
          Nombre (opcional)
        </label>
        <input
          id="free-name"
          type="text"
          maxLength={60}
          autoComplete="off"
          placeholder="Para saludarlo en el mail"
          className={FIELD}
          {...register('name')}
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>
        )}
      </div>
      <div>
        <label htmlFor="free-deadline" className={LABEL}>
          Pueden entrar hasta
        </label>
        <select
          id="free-deadline"
          className={FIELD}
          {...register('validUntil')}
        >
          <option value="">Todo el evento</option>
          {deadlines.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
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
          {isSubmitting ? 'Enviando...' : 'Enviar'}
        </button>
      </div>
    </form>
  );
}
