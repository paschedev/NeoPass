'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { getEventPhase } from '@/utils/event-edit';
import { eventStatusBadge } from '@/utils/event-status';
import { formatEventRange } from '@/utils/format';
import { formatPercentage } from '@/utils/service-fee';
import ServiceFeeModal from './ServiceFeeModal';
import type { AdminEvent, AdminEventsPage } from './types';

function eventsUrl(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set('q', search);
  params.set('page', String(page));
  return `/admin/events?${params}`;
}

function AdminEventCard({
  event,
  onChangeFee,
}: {
  event: AdminEvent;
  onChangeFee: () => void;
}) {
  const titleId = useId();
  const badge = eventStatusBadge(event);
  // Un evento cerrado ya no vende: el backend tampoco deja cambiar su cargo.
  const sells = getEventPhase(event, new Date()) !== 'CLOSED';

  return (
    <article
      aria-labelledby={titleId}
      className="bg-neutral-900 border border-white/5 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    >
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
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        <p className="text-sm font-semibold text-white tabular-nums">
          Cargo: {formatPercentage(event.neoPassFeePercentage)}
        </p>
        {sells && (
          <button
            type="button"
            aria-label={`Cambiar el cargo de ${event.title}`}
            onClick={onChangeFee}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            Cambiar el cargo
          </button>
        )}
      </div>
    </article>
  );
}

// Los eventos de todos los organizadores, con el cargo de servicio de cada uno.
export default function AdminEvents() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminEventsPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [editing, setEditing] = useState<AdminEvent | null>(null);

  useEffect(() => {
    let current = true;
    apiFetch(eventsUrl(search, page))
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET admin events ${res.status}`);
        return (await res.json()) as AdminEventsPage;
      })
      .then((loaded) => {
        if (current) setData(loaded);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [search, page, version]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(query.trim());
  };

  const reload = () => {
    setFailed(false);
    setVersion((count) => count + 1);
  };

  const saveFee = (eventId: string, percentage: string) => {
    setData(
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) =>
            item.id === eventId
              ? { ...item, neoPassFeePercentage: percentage }
              : item,
          ),
        },
    );
    setEditing(null);
  };

  const renderList = () => {
    if (failed) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-10 text-center">
          <p className="text-neutral-300 mb-4">
            No pudimos cargar los eventos.
          </p>
          <button
            type="button"
            onClick={reload}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-colors font-medium"
          >
            Reintentar
          </button>
        </div>
      );
    }
    if (!data) {
      return (
        <p className="text-center py-12 text-neutral-500">
          Cargando eventos...
        </p>
      );
    }
    if (data.items.length === 0) {
      return (
        <p className="text-center py-12 px-6 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed text-neutral-400">
          {search
            ? 'No hay eventos que coincidan con la búsqueda.'
            : 'Todavía no hay eventos.'}
        </p>
      );
    }

    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
    return (
      <>
        <ul className="space-y-3">
          {data.items.map((event) => (
            <li key={event.id}>
              <AdminEventCard
                event={event}
                onChangeFee={() => setEditing(event)}
              />
            </li>
          ))}
        </ul>
        <nav
          aria-label="Páginas de eventos"
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={page <= 1}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-neutral-400">
            Página {page} de {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-40"
          >
            Siguiente
          </button>
        </nav>
      </>
    );
  };

  return (
    <section aria-labelledby="admin-events-title" className="space-y-6">
      <div>
        <h2 id="admin-events-title" className="font-outfit text-2xl font-bold">
          Eventos
        </h2>
        <p className="text-sm text-neutral-400">
          Todos los eventos de NeoPass y el cargo de servicio de cada uno.
        </p>
      </div>

      <form role="search" onSubmit={submitSearch} className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Buscar por evento o email del organizador"
          placeholder="Evento o email del organizador"
          maxLength={100}
          className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
        >
          <Search className="w-4 h-4" /> Buscar
        </button>
      </form>

      {renderList()}

      <ServiceFeeModal
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={(percentage) => editing && saveFee(editing.id, percentage)}
      />
    </section>
  );
}
