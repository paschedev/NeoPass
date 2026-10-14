'use client';

import { useId, useState } from 'react';
import { Send } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import toast from '@/utils/toast';
import type { AdminTicket } from './types';

// Manda otra vez la misma entrada, solo a quien la tiene. Antes de confirmar
// dice a qué correo va.
export default function ResendTicketModal({
  ticket,
  onClose,
}: {
  ticket: AdminTicket | null;
  onClose: () => void;
}) {
  const titleId = useId();
  const [sending, setSending] = useState(false);
  if (!ticket?.owner) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await apiFetch(`/admin/tickets/${ticket.id}/resend`, {
        method: 'POST',
      });
      if (res.ok) {
        const { sentTo } = (await res.json()) as { sentTo: string };
        toast.success(`Entrada reenviada a ${sentTo}`);
        onClose();
        return;
      }
      toast.error(
        res.status === 429
          ? 'Llegaste al tope de reenvíos. Probá de nuevo en un rato.'
          : getApiErrorMessage(
              await res.json().catch(() => null),
              'No pudimos reenviar la entrada',
            ),
      );
    } catch {
      toast.error('Error de conexión');
    } finally {
      setSending(false);
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
        <Send className="w-6 h-6 text-indigo-400 shrink-0 mt-0.5" />
        <h2 id={titleId} className="font-outfit text-xl font-bold text-white">
          Reenviar la entrada
        </h2>
      </div>

      <ul className="space-y-2 text-sm text-neutral-300 list-disc pl-5">
        <li className="break-words">Le llega a {ticket.owner.email}.</li>
        <li>Es la misma entrada: el QR no cambia.</li>
      </ul>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={sending}
          className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {sending ? 'Reenviando...' : 'Reenviar'}
        </button>
      </div>
    </Modal>
  );
}
