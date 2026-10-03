'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatCurrency } from '@/utils/format';
import {
  buildPaymentSchema,
  formatAmountInput,
  type PaymentFormInput,
  type PaymentFormOutput,
} from '@/utils/promoter-payment';

const FIELD =
  'w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500';

// Anota un pago a un RPP: propone el saldo y acepta pagos parciales.
export default function RegisterPaymentForm({
  promoterName,
  balance,
  titleId,
  onSubmit,
  onCancel,
}: {
  promoterName: string;
  balance: number;
  titleId: string;
  onSubmit: (payment: PaymentFormOutput) => Promise<void>;
  onCancel: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PaymentFormInput, unknown, PaymentFormOutput>({
    resolver: zodResolver(buildPaymentSchema(balance)),
    defaultValues: { amount: formatAmountInput(balance), note: '' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      <div>
        <h2 id={titleId} className="text-xl font-bold">
          Registrar pago a {promoterName}
        </h2>
        <p className="text-sm text-neutral-400 mt-2">
          Le deben {formatCurrency(balance)}. Esto solo lo anota: el pago lo
          hacés por fuera de NeoPass.
        </p>
      </div>
      <div>
        <label
          htmlFor="payment-amount"
          className="text-sm font-medium text-neutral-400 mb-1 block"
        >
          Monto
        </label>
        <input
          id="payment-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          className={FIELD}
          {...register('amount')}
        />
        {errors.amount && (
          <p className="text-red-400 text-xs mt-1">{errors.amount.message}</p>
        )}
      </div>
      <div>
        <label
          htmlFor="payment-note"
          className="text-sm font-medium text-neutral-400 mb-1 block"
        >
          Nota (opcional)
        </label>
        <input
          id="payment-note"
          type="text"
          maxLength={100}
          placeholder="Ej: Transferencia"
          className={FIELD}
          {...register('note')}
        />
        {errors.note && (
          <p className="text-red-400 text-xs mt-1">{errors.note.message}</p>
        )}
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
          className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          {isSubmitting ? 'Registrando...' : 'Registrar'}
        </button>
      </div>
    </form>
  );
}
