'use client';

import { useId, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  promoterFreeTicketLimitError,
  type PromoterFreeTickets,
} from '@/utils/promoter-free-tickets';
import toast from '@/utils/toast';

export interface FreeTicketsTarget {
  eventId: string;
  staffId: string;
  name: string;
  freeTickets: PromoterFreeTickets | null;
}

const BUTTON =
  'px-4 py-3 rounded-xl font-medium transition-colors disabled:opacity-50';

function FreeTicketsForm({
  target,
  titleId,
  onClose,
  onSaved,
}: {
  target: FreeTicketsTarget;
  titleId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const limitId = useId();
  const [limit, setLimit] = useState(
    target.freeTickets?.limit.toString() ?? '',
  );
  const [busy, setBusy] = useState(false);
  const sent = target.freeTickets?.sent ?? 0;

  const save = async (freeTicketLimit: number | null, success: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(
        `/events/organizer/${target.eventId}/promoters/${target.staffId}/free-tickets`,
        { method: 'PUT', body: JSON.stringify({ freeTicketLimit }) },
      );
      if (!res.ok) {
        toast.error(
          getApiErrorMessage(
            await res.json().catch(() => null),
            'No se pudieron guardar los QR free',
          ),
        );
        return;
      }
      toast.success(success);
      onSaved();
    } catch {
      toast.error('Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const error = promoterFreeTicketLimitError(limit);
    if (error) return toast.error(error);
    void save(Number(limit), `Guardamos los QR free de ${target.name}`);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 id={titleId} className="text-xl font-bold">
          QR free de {target.name}
        </h2>
        <p className="text-sm text-neutral-400">
          Cuántas entradas gratis puede mandar en este evento. Ve solo las suyas
          y no le dan comisión.
        </p>
      </div>
      <div>
        <label
          htmlFor={limitId}
          className="block text-sm font-medium text-neutral-400 mb-2"
        >
          Cantidad máxima
        </label>
        <input
          id={limitId}
          type="text"
          inputMode="numeric"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          placeholder="Ej: 10"
          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      {sent > 0 && (
        <p className="text-xs text-neutral-400">
          Ya mandó {sent}. Si bajás el tope o se los quitás, lo mandado sigue
          valiendo: solo frena los próximos.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className={`${BUTTON} flex-1 text-neutral-400 hover:bg-white/5`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`${BUTTON} flex-1 text-white bg-indigo-600 hover:bg-indigo-500`}
          >
            Guardar
          </button>
        </div>
        {target.freeTickets && (
          <button
            type="button"
            onClick={() =>
              void save(null, `${target.name} ya no puede mandar QR free`)
            }
            disabled={busy}
            className={`${BUTTON} border border-red-500/30 text-red-300 hover:bg-red-500/10`}
          >
            Quitar QR free
          </button>
        )}
      </div>
    </div>
  );
}

// Da, cambia o quita los QR free de un RPP en un evento. Solo lo usa el dueño
// (pestaña Mi staff); bajar el tope no anula lo que ya mandó.
export default function PromoterFreeTicketsModal({
  target,
  onClose,
  onSaved,
}: {
  target: FreeTicketsTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const titleId = useId();

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      labelledBy={titleId}
      className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl"
    >
      {target && (
        <FreeTicketsForm
          key={target.staffId}
          target={target}
          titleId={titleId}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}
