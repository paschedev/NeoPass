'use client';

import { useEffect, useId, useState } from 'react';
import { UserCog, UserPlus } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  INVITATION_STATUS_LABEL,
  buildCoOrganizerTerms,
  freeTicketLimitError,
  permissionsSummary,
  type EventPermission,
} from '@/utils/co-organizers';
import toast from '@/utils/toast';
import CoOrganizerPermissionsFields from '../CoOrganizerPermissionsFields';
import InviteStaffModal from '../InviteStaffModal';
import type { CoOrganizer } from './types';

const MODAL =
  'bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl overflow-y-auto overscroll-contain max-h-[90vh]';

const STATUS_STYLES: Record<string, string> = {
  ACCEPTED: 'bg-emerald-500/15 text-emerald-300',
  PENDING: 'bg-amber-500/15 text-amber-300',
  REJECTED: 'bg-white/10 text-neutral-400',
};

const SECONDARY_BUTTON =
  'flex-1 px-4 py-3 rounded-xl font-medium text-neutral-300 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50';

// Co-organizadores del evento: quiénes son, qué pueden hacer y su invitación.
// Solo los ve y los maneja quien organiza el evento; los cambios valen al
// momento y quedan en el historial.
export default function CoOrganizers({
  event,
  canInvite,
}: {
  event: { id: string; title: string };
  canInvite: boolean;
}) {
  const [list, setList] = useState<CoOrganizer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<CoOrganizer | null>(null);
  const [permissions, setPermissions] = useState<EventPermission[]>([]);
  const [freeTicketLimit, setFreeTicketLimit] = useState('');
  const [removing, setRemoving] = useState<CoOrganizer | null>(null);
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const editTitleId = useId();
  const removeTitleId = useId();
  const path = `/events/organizer/${event.id}/co-organizers`;
  const reload = () => setVersion((count) => count + 1);

  useEffect(() => {
    let current = true;
    apiFetch(path)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET co-organizers ${res.status}`);
        return (await res.json()) as CoOrganizer[];
      })
      .then((found) => {
        if (current) setList(found);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [path, version]);

  const startEditing = (coOrganizer: CoOrganizer) => {
    setPermissions(coOrganizer.permissions);
    setFreeTicketLimit(coOrganizer.freeTicketLimit?.toString() ?? '');
    setEditing(coOrganizer);
  };

  // PUT o DELETE sobre un co-organizador; devuelve si salió bien.
  const send = async (
    coOrganizer: CoOrganizer,
    init: RequestInit,
    fallback: string,
  ) => {
    setBusy(true);
    try {
      const res = await apiFetch(`${path}/${coOrganizer.id}`, init);
      if (res.ok) return true;
      toast.error(
        getApiErrorMessage(await res.json().catch(() => null), fallback),
      );
    } catch {
      toast.error('Error de conexión');
    } finally {
      setBusy(false);
    }
    return false;
  };

  const save = async (coOrganizer: CoOrganizer) => {
    const limitError = freeTicketLimitError(freeTicketLimit);
    if (limitError) return toast.error(limitError);
    const saved = await send(
      coOrganizer,
      {
        method: 'PUT',
        body: JSON.stringify(
          buildCoOrganizerTerms(permissions, freeTicketLimit),
        ),
      },
      'No se pudieron guardar los permisos',
    );
    if (saved) {
      toast.success(`Guardamos los permisos de ${coOrganizer.name}`);
      setEditing(null);
      reload();
    }
  };

  const remove = async (coOrganizer: CoOrganizer) => {
    const removed = await send(
      coOrganizer,
      { method: 'DELETE' },
      'No se pudo quitar al co-organizador',
    );
    if (removed) {
      toast.success(`${coOrganizer.name} ya no co-organiza el evento`);
      setRemoving(null);
      reload();
    }
  };

  return (
    <section aria-label="Co-organizadores" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserCog className="w-5 h-5 text-sky-400" /> Co-organizadores
        </h2>
        {canInvite && (
          <button
            type="button"
            onClick={() => setInviting(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Invitar co-organizador
          </button>
        )}
      </div>
      <p className="text-sm text-neutral-400">
        Te ayudan con el evento con los permisos que les des. Cobrar,
        publicar, cancelar y sumar co-organizadores es solo tuyo.
      </p>

      {failed && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar los co-organizadores.
        </p>
      )}
      {!failed && list === null && (
        <p className="text-sm text-neutral-400">Cargando co-organizadores...</p>
      )}
      {list?.length === 0 && (
        <p className="text-sm text-neutral-400">
          Este evento no tiene co-organizadores.
        </p>
      )}

      {list && list.length > 0 && (
        <ul className="bg-neutral-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {list.map((coOrganizer) => (
            <li
              key={coOrganizer.id}
              aria-label={coOrganizer.name}
              className="flex flex-col md:flex-row md:items-center gap-3 px-4 py-3"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">
                    {coOrganizer.name}
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[coOrganizer.status] ?? STATUS_STYLES.REJECTED}`}
                  >
                    {INVITATION_STATUS_LABEL[coOrganizer.status] ??
                      coOrganizer.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 break-all">
                  {coOrganizer.email}
                </p>
                <p className="text-xs text-neutral-300">
                  {permissionsSummary(
                    coOrganizer.permissions,
                    coOrganizer.freeTicketLimit,
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Editar permisos de ${coOrganizer.name}`}
                  onClick={() => startEditing(coOrganizer)}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors"
                >
                  Editar permisos
                </button>
                <button
                  type="button"
                  aria-label={`Quitar a ${coOrganizer.name}`}
                  onClick={() => setRemoving(coOrganizer)}
                  className="px-3 py-2 rounded-lg text-xs font-medium border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        labelledBy={editTitleId}
        className={MODAL}
      >
        {editing && (
          <div className="space-y-5">
            <h2 id={editTitleId} className="text-xl font-bold">
              Permisos de {editing.name}
            </h2>
            <CoOrganizerPermissionsFields
              permissions={permissions}
              onPermissionsChange={setPermissions}
              freeTicketLimit={freeTicketLimit}
              onFreeTicketLimitChange={setFreeTicketLimit}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={busy}
                className={SECONDARY_BUTTON}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save(editing)}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        labelledBy={removeTitleId}
        className={MODAL}
      >
        {removing && (
          <div className="space-y-5">
            <h2 id={removeTitleId} className="text-xl font-bold">
              ¿Quitar a {removing.name}?
            </h2>
            <p className="text-sm text-neutral-400">
              Deja de poder manejar el evento y de escanear. Lo que ya hizo
              (QR free mandados, pagos registrados) queda como está y en el
              historial.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRemoving(null)}
                disabled={busy}
                className={SECONDARY_BUTTON}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => void remove(removing)}
                disabled={busy}
                className="flex-1 px-4 py-3 rounded-xl font-medium text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                Quitar
              </button>
            </div>
          </div>
        )}
      </Modal>

      {inviting && (
        <InviteStaffModal
          open
          onClose={() => setInviting(false)}
          events={[event]}
          initialEventId={event.id}
          initialRole="CO_ORGANIZER"
          onInvited={reload}
        />
      )}
    </section>
  );
}
