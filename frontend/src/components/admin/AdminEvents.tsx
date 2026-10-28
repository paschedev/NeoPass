'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import DeleteEventModal from '@/components/events/DeleteEventModal';
import { useAdminList } from '@/hooks/useAdminList';
import { getEventPhase, isEventPublic } from '@/utils/event-edit';
import { eventStatusBadge } from '@/utils/event-status';
import {
  formatCurrency,
  formatDayMonthTime,
  formatEventRange,
} from '@/utils/format';
import { formatPercentage, mercadoPagoTermsLabel } from '@/utils/service-fee';
import toast from '@/utils/toast';
import AdminListView, { ADMIN_ACTION as ACTION } from './AdminListView';
import RestoreEventModal from './RestoreEventModal';
import ServiceFeeModal from './ServiceFeeModal';
import type { AdminEvent } from './types';

function AdminEventCard({
  event,
  onChangeFee,
  onDelete,
  onRestore,
}: {
  event: AdminEvent;
  onChangeFee: () => void;
  onDelete: () => void;
  onRestore: () => void;
}) {
  const titleId = useId();
  const badge = eventStatusBadge(event);
  const now = new Date();
  // Un evento cerrado ya no vende: el backend tampoco deja cambiar su cargo.
  const sells = getEventPhase(event, now) !== 'CLOSED';
  const { sold, capacity, revenue, marketplaceFee } = event.sales;

  return (
    <article
      aria-labelledby={titleId}
      className="bg-neutral-900 border border-white/5 rounded-3xl p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
            <span className="text-xs text-neutral-400">
              {formatEventRange(event.startDate, event.endDate)}
            </span>
          </div>
          <h3
            id={titleId}
            className="font-outfit text-lg font-bold text-white break-words"
          >
            {event.title}
          </h3>
          <p className="text-xs text-neutral-500 mt-1 break-words">
            {event.organizer.name} · {event.organizer.email}
          </p>
          <p className="text-xs text-neutral-500 break-words tabular-nums">
            {mercadoPagoTermsLabel(event.organizer)}
          </p>
          <p className="text-xs text-neutral-300 mt-2 tabular-nums">
            {sold} de {capacity} vendidas · Recaudado {formatCurrency(revenue)}{' '}
            · Para NeoPass {formatCurrency(marketplaceFee)}
          </p>
          {/* Su renglón queda reservado: dar de baja o restaurar no mueve la lista. */}
          <p className="text-xs text-red-400 mt-1 min-h-4">
            {event.deletedAt &&
              `Eliminado el ${formatDayMonthTime(event.deletedAt)} ${
                event.deletedByNeoPass ? 'por NeoPass' : 'por el organizador'
              }`}
          </p>
        </div>
        <p className="text-sm font-semibold text-white tabular-nums shrink-0">
          Cargo: {formatPercentage(event.neoPassFeePercentage)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {sells && (
          <button
            type="button"
            aria-label={`Cambiar el cargo de ${event.title}`}
            onClick={onChangeFee}
            className={`${ACTION} bg-white/10 hover:bg-white/20 text-white`}
          >
            Cambiar el cargo
          </button>
        )}
        {isEventPublic(event, now) && (
          <Link
            href={`/eventos/${event.id}`}
            target="_blank"
            className={`${ACTION} bg-white/5 hover:bg-white/10 text-white`}
          >
            Ver página pública <ExternalLink className="w-4 h-4" />
          </Link>
        )}
        {event.deletedAt ? (
          <button
            type="button"
            aria-label={`Restaurar ${event.title}`}
            onClick={onRestore}
            className={`${ACTION} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300`}
          >
            Restaurar
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Dar de baja ${event.title}`}
            onClick={onDelete}
            className={`${ACTION} bg-red-500/10 hover:bg-red-500/20 text-red-400`}
          >
            Dar de baja
          </button>
        )}
      </div>
    </article>
  );
}

// Los eventos de todos los organizadores, con el cargo de servicio de cada uno.
export default function AdminEvents({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (q: string) => void;
}) {
  const list = useAdminList<AdminEvent>('/admin/events', search);
  const updateEvent = list.updateItem;
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [deleting, setDeleting] = useState<AdminEvent | null>(null);
  const [restoring, setRestoring] = useState<AdminEvent | null>(null);

  const saveFee = (eventId: string, percentage: string) => {
    updateEvent(eventId, { neoPassFeePercentage: percentage });
    setEditing(null);
  };

  const markDeleted = (eventId: string) => {
    toast.success('Evento dado de baja');
    updateEvent(eventId, {
      deletedAt: new Date().toISOString(),
      deletedByNeoPass: true,
    });
    setDeleting(null);
  };

  const markRestored = (eventId: string) => {
    updateEvent(eventId, { deletedAt: null, deletedByNeoPass: null });
    setRestoring(null);
  };

  return (
    <section aria-labelledby="admin-events-title" className="space-y-6">
      <div>
        <h2 id="admin-events-title" className="sr-only">
          Eventos
        </h2>
        <p className="text-sm text-neutral-400">
          Todos los eventos de NeoPass y el cargo de servicio de cada uno.
        </p>
      </div>

      <AdminListView
        list={list}
        search={search}
        onSearch={onSearch}
        searchLabel="Buscar por evento o email del organizador"
        searchPlaceholder="Evento o email del organizador"
        texts={{
          loading: 'Cargando eventos...',
          failed: 'No pudimos cargar los eventos.',
          empty: 'Todavía no hay eventos.',
          noMatches: 'No hay eventos que coincidan con la búsqueda.',
        }}
        pagerLabel="Páginas de eventos"
        renderItem={(event) => (
          <AdminEventCard
            event={event}
            onChangeFee={() => setEditing(event)}
            onDelete={() => setDeleting(event)}
            onRestore={() => setRestoring(event)}
          />
        )}
      />

      <ServiceFeeModal
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={(percentage) => editing && saveFee(editing.id, percentage)}
      />
      {deleting && (
        <DeleteEventModal
          event={deleting}
          open
          onClose={() => setDeleting(null)}
          onDeleted={() => markDeleted(deleting.id)}
          asOrganizer={null}
        />
      )}
      <RestoreEventModal
        event={restoring}
        onClose={() => setRestoring(null)}
        onRestored={() => restoring && markRestored(restoring.id)}
      />
    </section>
  );
}
