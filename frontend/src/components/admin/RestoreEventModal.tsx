'use client';

import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { isEventPublic } from '@/utils/event-edit';
import toast from '@/utils/toast';
import type { AdminEvent } from './types';

// Devuelve un evento eliminado a como estaba. Antes de confirmar dice qué
// cambia: si todavía vende, vuelve a la venta y sus entradas vuelven a servir.
export default function RestoreEventModal({
  event,
  onClose,
  onRestored,
}: {
  event: AdminEvent | null;
  onClose: () => void;
  onRestored: () => void;
}) {
  const titleId = useId();
  const [restoring, setRestoring] = useState(false);
  if (!event) return null;

  const sellsAgain = isEventPublic({ ...event, deletedAt: null }, new Date());

  const restore = async () => {
    setRestoring(true);
    try {
      const res = await apiFetch(`/admin/events/${event.id}/restore`, {
        method: 'PATCH',
      });
      if (res.ok) {
        toast.success('Evento restaurado');
        onRestored();
        return;
      }
      toast.error(
        getApiErrorMessage(
          await res.json().catch(() => null),
          'No pudimos restaurar el evento',
        ),
      );
    } catch {
      toast.error('Error de conexión');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      labelledBy={titleId}
      className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-5"
    >
      <div className="flex items-start gap-3">
        <RotateCcw className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
        <h2
          id={titleId}
          className="font-outfit text-xl font-bold text-white break-words"
        >
          Restaurar «{event.title}»
        </h2>
      </div>

      <ul className="space-y-2 text-sm text-neutral-300 list-disc pl-5">
        <li>Vuelve como estaba antes de que lo eliminaran.</li>
        {sellsAgain ? (
          <>
            <li>Vuelve a la vista pública y se pueden comprar entradas.</li>
            <li>
              Sus entradas vuelven a servir para entrar y avisamos a quienes
              las tienen.
            </li>
          </>
        ) : (
          <li>Ya no vende entradas: vuelve a su historial.</li>
        )}
        <li>Avisamos al organizador.</li>
      </ul>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={restoring}
          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={restore}
          disabled={restoring}
          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {restoring ? 'Restaurando...' : 'Restaurar'}
        </button>
      </div>
    </Modal>
  );
}
