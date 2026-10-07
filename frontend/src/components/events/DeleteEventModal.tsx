'use client';

import { useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import DeletionNotice from '@/components/tickets/DeletionNotice';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { isDeletionConfirmed } from '@/utils/event-deletion';
import toast from '@/utils/toast';

const INPUT_CLASS =
  'w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-neutral-500 focus:outline-none focus:border-red-500/50';

// Eliminar un evento (su organizador) o darlo de baja (un ADMIN de NeoPass):
// muestra las consecuencias y pide escribir el nombre para confirmar.
export default function DeleteEventModal({
  event,
  open,
  onClose,
  onDeleted,
  asOrganizer,
}: {
  event: { id: string; title: string };
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
  // El organizador: cuántas entradas vendió, su nombre y el email de su
  // cuenta. null: un ADMIN que lo da de baja.
  asOrganizer: { ticketsSold: number; name: string; accountEmail: string } | null;
}) {
  const ids = useId();
  const [typed, setTyped] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const confirmed = isDeletionConfirmed(typed, event.title);
  const chosenEmail = contactEmail.trim();

  const submit = async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/events/${event.id}`, {
        method: 'DELETE',
        body: JSON.stringify(
          asOrganizer && chosenEmail ? { contactEmail: chosenEmail } : {},
        ),
      });
      if (res.ok) {
        onDeleted();
        return;
      }
      toast.error(
        getApiErrorMessage(
          await res.json().catch(() => null),
          'No pudimos eliminar el evento',
        ),
      );
    } catch {
      toast.error('Error de conexión');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy={`${ids}-title`}
      className="bg-neutral-900 border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl max-h-[85vh] overflow-y-auto overscroll-contain"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
          <h2
            id={`${ids}-title`}
            className="font-outfit text-xl font-bold text-white break-words"
          >
            {asOrganizer ? 'Eliminar' : 'Dar de baja'} «{event.title}»
          </h2>
        </div>

        <ul className="space-y-2 text-sm text-neutral-300 list-disc pl-5">
          {asOrganizer ? (
            <>
              <li>
                Deja de verse en NeoPass: nadie más puede encontrarlo ni comprar
                entradas.
              </li>
              <li>
                No se puede deshacer, y el evento ya no se puede editar ni
                escanear.
              </li>
              {asOrganizer.ticketsSold > 0 && (
                <li className="text-amber-300">
                  Ya vendiste {asOrganizer.ticketsSold} entradas. Quienes
                  compraron conservan su entrada con el aviso de abajo. Las
                  devoluciones y los reclamos quedan a tu cargo (o de tu
                  productora), no NeoPass.
                </li>
              )}
              <li>
                Las ventas siguen registradas: tus métricas, el historial del
                staff y las comisiones y pagos de los RPP no cambian.
              </li>
            </>
          ) : (
            <>
              <li>
                Sale de la vista pública: nadie más puede encontrarlo ni comprar
                entradas.
              </li>
              <li>
                El organizador y su staff lo siguen viendo, con sus ventas,
                como eliminado.
              </li>
              <li>
                Quien compró ve el aviso «NeoPass dio de baja este evento» con el
                email del organizador para consultas o devoluciones.
              </li>
              <li>No se puede deshacer desde la app.</li>
            </>
          )}
        </ul>

        {asOrganizer && (
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`${ids}-email`}
                className="block text-sm font-medium text-neutral-300 mb-2"
              >
                Email de contacto para quienes compraron (opcional)
              </label>
              <input
                id={`${ids}-email`}
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={asOrganizer.accountEmail}
                className={INPUT_CLASS}
              />
              <p className="text-xs text-neutral-500 mt-1">
                Si lo dejás vacío, mostramos el email de tu cuenta.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                Lo que ve quien compró
              </p>
              <div data-testid="deletion-preview">
                <DeletionNotice
                  deletion={{
                    byNeoPass: false,
                    organizerName: asOrganizer.name,
                    contactEmail: chosenEmail || asOrganizer.accountEmail,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor={`${ids}-confirm`}
            className="block text-sm text-neutral-300 mb-2"
          >
            Escribí el nombre del evento para confirmar:{' '}
            <strong className="text-white">{event.title}</strong>
          </label>
          <input
            id={`${ids}-confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!confirmed || deleting}
            className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting
              ? 'Eliminando...'
              : asOrganizer
                ? 'Eliminar evento'
                : 'Dar de baja'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
