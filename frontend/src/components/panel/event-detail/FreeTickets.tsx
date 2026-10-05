'use client';

import { useEffect, useId, useState } from 'react';
import { Gift } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { formatWeekdayDateTime } from '@/utils/format';
import {
  freeTicketsSent,
  type FreeTicketGrant,
  type FreeTicketsFormOutput,
} from '@/utils/free-tickets';
import { freeTicketsLeft } from '@/utils/co-organizers';
import toast from '@/utils/toast';
import SendFreeTicketsForm from './SendFreeTicketsForm';

const MODAL =
  'bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl';

// Lo enviado sin las anuladas que nadie usó, y cuántas personas entraron.
function summarize(grants: FreeTicketGrant[]): string {
  const sent = freeTicketsSent(grants);
  const checkedIn = grants.reduce((sum, grant) => sum + grant.checkedIn, 0);
  return `${sent} ${sent === 1 ? 'entrada enviada' : 'entradas enviadas'} · ${checkedIn} ${checkedIn === 1 ? 'ingresó' : 'ingresaron'}`;
}

// QR free del evento: entradas gratis que el organizador (o un co-organizador
// con permiso, que ve solo las suyas) manda por mail, sin descontar stock. Se
// pueden reenviar y anular.
export default function FreeTickets({
  eventId,
  event,
  ticketTypes,
  sendBlockedReason,
  limit = null,
  ownerId = null,
}: {
  eventId: string;
  event: { startDate: string; endDate: string };
  ticketTypes: { id: string; label: string }[];
  sendBlockedReason: string | null;
  // Tope del co-organizador; null = sin tope.
  limit?: number | null;
  // Solo para el dueño: marca los envíos que mandó un co-organizador.
  ownerId?: string | null;
}) {
  const [grants, setGrants] = useState<FreeTicketGrant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState<FreeTicketGrant | null>(null);
  const [busy, setBusy] = useState(false);
  const sendTitleId = useId();
  const cancelTitleId = useId();
  const path = `/events/organizer/${eventId}/free-tickets`;
  const reload = () => setVersion((count) => count + 1);
  const sentByOther = (grant: FreeTicketGrant) =>
    ownerId !== null && grant.issuedById !== ownerId;

  useEffect(() => {
    let current = true;
    apiFetch(path)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET free-tickets ${res.status}`);
        return (await res.json()) as FreeTicketGrant[];
      })
      .then((list) => {
        if (current) setGrants(list);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [path, version]);

  // POST a la ruta; devuelve si salió bien y muestra el error si no.
  const post = async (url: string, body: unknown, fallback: string) => {
    try {
      const res = await apiFetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) return true;
      toast.error(getApiErrorMessage(await res.json(), fallback));
    } catch {
      toast.error('Error de conexión');
    }
    return false;
  };

  const send = async (grant: FreeTicketsFormOutput) => {
    if (await post(path, grant, 'No se pudo mandar el QR free')) {
      toast.success(`Mandamos el QR free a ${grant.email}`);
      setSending(false);
      reload();
    }
  };

  const resend = async (grant: FreeTicketGrant) => {
    setBusy(true);
    if (await post(`${path}/${grant.id}/resend`, {}, 'No se pudo reenviar')) {
      toast.success(`Reenviamos el mail a ${grant.recipientEmail}`);
    }
    setBusy(false);
  };

  const cancel = async (grant: FreeTicketGrant) => {
    setBusy(true);
    if (await post(`${path}/${grant.id}/cancel`, {}, 'No se pudo anular')) {
      toast.success('Envío anulado');
      setCancelling(null);
      reload();
    }
    setBusy(false);
  };

  return (
    <section aria-label="QR free" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Gift className="w-5 h-5 text-pink-400" /> QR free
        </h2>
        {!sendBlockedReason && (
          <button
            type="button"
            onClick={() => setSending(true)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            Enviar QR free
          </button>
        )}
      </div>
      {sendBlockedReason && (
        <p className="text-sm text-neutral-400">{sendBlockedReason}</p>
      )}
      {grants && limit !== null && (
        <p className="text-sm text-neutral-300">
          Te quedan {freeTicketsLeft(limit, grants)} de tus {limit} QR free.
        </p>
      )}

      {failed && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar los QR free del evento.
        </p>
      )}
      {!failed && grants === null && (
        <p className="text-sm text-neutral-400">Cargando QR free...</p>
      )}
      {grants?.length === 0 && (
        <p className="text-sm text-neutral-400">Todavía no mandaste QR free.</p>
      )}

      {grants && grants.length > 0 && (
        <>
          <p className="text-sm text-neutral-300">{summarize(grants)}</p>
          <ul className="bg-neutral-900 border border-white/5 rounded-2xl divide-y divide-white/5">
            {grants.map((grant) => (
              <li
                key={grant.id}
                aria-label={grant.recipientEmail}
                className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-white break-all">
                      {grant.recipientEmail}
                    </span>
                    {grant.recipientName && (
                      <span className="text-sm text-neutral-400">
                        {grant.recipientName}
                      </span>
                    )}
                    {grant.status === 'CANCELLED' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-300">
                        Anulado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400">
                    {grant.ticketType.name} · {grant.checkedIn} de{' '}
                    {grant.quantity} ingresaron
                    {grant.validUntil &&
                      ` · Hasta ${formatWeekdayDateTime(grant.validUntil)}`}
                    {sentByOther(grant) && ` · Mandó ${grant.issuedBy.name}`}
                  </p>
                </div>
                {grant.status === 'ACTIVE' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Reenviar a ${grant.recipientEmail}`}
                      disabled={busy}
                      onClick={() => void resend(grant)}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                      Reenviar
                    </button>
                    <button
                      type="button"
                      aria-label={`Anular el envío a ${grant.recipientEmail}`}
                      disabled={busy}
                      onClick={() => setCancelling(grant)}
                      className="px-3 py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Anular
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal
        open={sending}
        onClose={() => setSending(false)}
        labelledBy={sendTitleId}
        className={MODAL}
      >
        <SendFreeTicketsForm
          event={event}
          ticketTypes={ticketTypes}
          titleId={sendTitleId}
          onSubmit={send}
          onCancel={() => setSending(false)}
        />
      </Modal>

      <Modal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        labelledBy={cancelTitleId}
        className={MODAL}
      >
        {cancelling && (
          <div className="space-y-5">
            <h2 id={cancelTitleId} className="text-xl font-bold">
              ¿Anular el envío a {cancelling.recipientEmail}?
            </h2>
            <p className="text-sm text-neutral-400">
              Las entradas que todavía no se usaron dejan de servir en la
              puerta. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelling(null)}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-neutral-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void cancel(cancelling)}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Anular envío
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
