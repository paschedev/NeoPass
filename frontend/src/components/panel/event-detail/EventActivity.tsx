'use client';

import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatDayMonthTime } from '@/utils/format';
import type { ActivityPage } from './types';

type Entry = ActivityPage['items'][number];

// Historial del evento: qué se cambió y quién lo hizo (el dueño y sus
// co-organizadores), lo más nuevo primero y de a una página.
export default function EventActivity({ eventId }: { eventId: string }) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [failed, setFailed] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let current = true;
    apiFetch(`/events/organizer/${eventId}/activity?page=${page}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET activity ${res.status}`);
        return (await res.json()) as ActivityPage;
      })
      .then((found) => {
        if (!current) return;
        setEntries((shown) =>
          page === 1 ? found.items : [...(shown ?? []), ...found.items],
        );
        setTotal(found.total);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      })
      .finally(() => {
        if (current) setLoadingMore(false);
      });
    return () => {
      current = false;
    };
  }, [eventId, page]);

  const hasMore = entries !== null && entries.length < total;

  return (
    <section aria-label="Historial" className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <History className="w-5 h-5 text-neutral-400" /> Historial
      </h2>

      {failed && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar el historial.
        </p>
      )}
      {!failed && entries === null && (
        <p className="text-sm text-neutral-400">Cargando historial...</p>
      )}
      {entries?.length === 0 && (
        <p className="text-sm text-neutral-400">
          Todavía no hay cambios en este evento.
        </p>
      )}

      {entries && entries.length > 0 && (
        <ul className="bg-neutral-900 border border-white/5 rounded-2xl divide-y divide-white/5">
          {entries.map((entry) => (
            <li
              key={entry.id}
              aria-label={entry.summary}
              className="px-4 py-3 space-y-1"
            >
              <p className="text-sm text-neutral-200">{entry.summary}</p>
              <p className="text-xs text-neutral-500">
                {entry.actor.name} · {formatDayMonthTime(entry.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true);
            setPage((current) => current + 1);
          }}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          Ver más
        </button>
      )}
    </section>
  );
}
