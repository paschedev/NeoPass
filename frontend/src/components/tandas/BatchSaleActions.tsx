'use client';

import { useId, useState } from 'react';
import { CircleStop, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { type BatchSaleAction, getBatchSaleActions } from '@/utils/batches';
import type { EventFormInput } from '@/utils/event-form';
import toast from '@/utils/toast';

type SavedSale = {
  isVisible: boolean;
  publishAt: string | null;
  closeAt: string | null;
};

const DANGER_BUTTON =
  'border-red-500/30 text-red-300 hover:bg-red-500/10 focus-visible:ring-red-500/40';
const SAFE_BUTTON =
  'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 focus-visible:ring-emerald-500/40';
const NEUTRAL_BUTTON =
  'border-white/15 text-neutral-200 hover:bg-white/10 focus-visible:ring-white/30';
const DANGER_CONFIRM = 'bg-red-600 hover:bg-red-500';
const SAFE_CONFIRM = 'bg-emerald-600 hover:bg-emerald-500';

const ACTIONS: Record<
  BatchSaleAction,
  {
    label: string;
    icon: typeof Eye;
    buttonClass: string;
    confirmClass: string;
    question: (name: string) => string;
    consequence: string;
    done: string;
  }
> = {
  END: {
    label: 'Finalizar venta',
    icon: CircleStop,
    buttonClass: DANGER_BUTTON,
    confirmClass: DANGER_CONFIRM,
    question: (name) => `¿Finalizar la venta de «${name}»?`,
    consequence:
      'Nadie más va a poder comprar entradas de esta tanda. Quienes ya están pagando pueden terminar su compra. Podés reabrirla cuando quieras.',
    done: 'Venta finalizada',
  },
  REOPEN: {
    label: 'Reabrir venta',
    icon: RotateCcw,
    buttonClass: SAFE_BUTTON,
    confirmClass: SAFE_CONFIRM,
    question: (name) => `¿Reabrir la venta de «${name}»?`,
    consequence:
      'La tanda vuelve a venderse desde ahora y hasta que termine el evento.',
    done: 'Venta reabierta',
  },
  HIDE: {
    label: 'Ocultar tanda',
    icon: EyeOff,
    buttonClass: NEUTRAL_BUTTON,
    confirmClass: DANGER_CONFIRM,
    question: (name) => `¿Ocultar «${name}»?`,
    consequence:
      'Deja de verse en la página del evento y no se puede comprar. Quienes ya están pagando pueden terminar su compra.',
    done: 'Tanda oculta',
  },
  SHOW: {
    label: 'Mostrar tanda',
    icon: Eye,
    buttonClass: NEUTRAL_BUTTON,
    confirmClass: SAFE_CONFIRM,
    question: (name) => `¿Mostrar «${name}»?`,
    consequence:
      'Vuelve a verse en la página del evento y, si su venta está abierta, se puede comprar.',
    done: 'Tanda visible',
  },
};

// Finalizar o reabrir la venta de una tanda guardada (y ocultarla o mostrarla
// con el evento en curso). Se aplican en el momento, sin guardar el formulario.
export default function BatchSaleActions({
  eventId,
  batchIndex,
  eventInProgress,
  onApplied,
}: {
  eventId: string;
  batchIndex: number;
  eventInProgress: boolean;
  onApplied: (saved: SavedSale) => void;
}) {
  const titleId = useId();
  const { control, setValue } = useFormContext<EventFormInput>();
  const batch = useWatch({ control, name: `batches.${batchIndex}` });
  const [pending, setPending] = useState<BatchSaleAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const apply = async (action: BatchSaleAction) => {
    setSubmitting(true);
    try {
      const response = await apiFetch(
        `/events/${eventId}/batches/${batch.id}/sale`,
        { method: 'PUT', body: JSON.stringify({ action }) },
      );
      const body: unknown = await response.json();
      if (!response.ok) {
        toast.error(getApiErrorMessage(body, 'No se pudo aplicar el cambio'));
        return;
      }
      const saved = body as SavedSale;
      setValue(`batches.${batchIndex}.isVisible`, saved.isVisible);
      setValue(`batches.${batchIndex}.publishAt`, saved.publishAt);
      setValue(`batches.${batchIndex}.closeAt`, saved.closeAt);
      onApplied(saved);
      toast.success(ACTIONS[action].done);
      setPending(null);
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  const close = () => {
    if (!submitting) setPending(null);
  };
  const confirming = pending ? ACTIONS[pending] : null;

  return (
    <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:justify-end gap-2">
      {getBatchSaleActions(batch, new Date(), eventInProgress).map((action) => {
        const { label, icon: Icon, buttonClass } = ACTIONS[action];
        return (
          <button
            key={action}
            type="button"
            onClick={() => setPending(action)}
            className={`min-h-[40px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 ${buttonClass}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        );
      })}

      <Modal
        open={pending !== null}
        onClose={close}
        labelledBy={titleId}
        className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl"
      >
        {pending && confirming && (
          <>
            <h2 id={titleId} className="text-xl font-bold mb-2">
              {confirming.question(batch.name)}
            </h2>
            <p className="text-sm text-neutral-400 mb-8">
              {confirming.consequence}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={close}
                disabled={submitting}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void apply(pending)}
                disabled={submitting}
                className={`flex-1 px-4 py-3 rounded-xl font-medium text-white transition-colors disabled:opacity-50 ${confirming.confirmClass}`}
              >
                {submitting ? 'Aplicando...' : confirming.label}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
