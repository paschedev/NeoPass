'use client';

import { useEffect, useState } from 'react';
import { Download, Search, UserCheck } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatShortDateTime } from '@/utils/format';
import toast from '@/utils/toast';

// Sin el email: los compradores todavía no aceptaron compartirlo con el
// equipo del organizador (FEAT-20).
type Attendee = {
  ticketId: string;
  name: string | null;
  ticketType: string;
  batch: string | null;
  status: string;
  checkedInAt: string | null;
  // Llegó como QR free: el nombre es el del envío.
  freeTicket: boolean;
};

type AttendeePage = {
  items: Attendee[];
  total: number;
  page: number;
  limit: number;
};

const SEARCH_DELAY_MS = 300;

const STATUS: Record<string, { label: string; className: string }> = {
  VALID: { label: 'Válida', className: 'bg-indigo-500/10 text-indigo-300' },
  USED: { label: 'Ingresó', className: 'bg-emerald-500/10 text-emerald-400' },
  REFUNDED: { label: 'Devuelta', className: 'bg-red-500/10 text-red-400' },
  CANCELLED: { label: 'Anulada', className: 'bg-white/10 text-neutral-400' },
};

// Quiénes tienen entrada (el dueño actual, también después de una
// transferencia), con búsqueda, páginas y exportación a CSV.
export default function AttendeeList({ eventId }: { eventId: string }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [result, setResult] = useState<AttendeePage | null>(null);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const basePath = `/events/organizer/${eventId}/attendees`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPageNumber(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    params.set('page', String(pageNumber));
    apiFetch(`${basePath}?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET attendees ${res.status}`);
        return (await res.json()) as AttendeePage;
      })
      .then((page) => {
        if (current) setResult(page);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [basePath, query, pageNumber]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiFetch(`${basePath}/export`);
      if (!res.ok) throw new Error(`GET export ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'publico.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error('No se pudo exportar la lista del público');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.limit))
    : 1;

  return (
    <section aria-label="Público" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-indigo-400" /> Público
        </h2>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Buscar"
              placeholder="Buscar por nombre"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={exporting}
            className="shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-neutral-200 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {failed && !result && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar la lista del público.
        </p>
      )}
      {result?.total === 0 && (
        <p className="text-sm text-neutral-400">
          {query
            ? `Nadie coincide con «${query}».`
            : 'Todavía no hay entradas emitidas.'}
        </p>
      )}

      {result && result.total > 0 && (
        <>
          <div className="relative bg-neutral-900 border border-white/5 rounded-2xl overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-xs text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Nombre</th>
                  <th className="px-3 py-2 text-left font-medium">Entrada</th>
                  <th className="px-3 py-2 text-left font-medium">Estado</th>
                  <th className="px-3 py-2 text-right font-medium">Ingreso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-neutral-200">
                {result.items.map((attendee) => {
                  const status = STATUS[attendee.status] ?? STATUS.CANCELLED;
                  return (
                    <tr key={attendee.ticketId}>
                      <td className="px-3 py-3 font-medium text-white">
                        {attendee.name ?? '—'}
                      </td>
                      <td className="px-3 py-3">
                        {attendee.batch
                          ? `${attendee.ticketType} · ${attendee.batch}`
                          : attendee.ticketType}
                        {attendee.freeTicket && (
                          <span className="ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 whitespace-nowrap">
                            QR free
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-neutral-400 whitespace-nowrap">
                        {attendee.checkedInAt
                          ? formatShortDateTime(attendee.checkedInAt)
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => setPageNumber((page) => page - 1)}
              disabled={pageNumber <= 1}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 transition-colors disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-neutral-400">
              {`Página ${result.page} de ${totalPages}`}
            </span>
            <button
              type="button"
              onClick={() => setPageNumber((page) => page + 1)}
              disabled={pageNumber >= totalPages}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-200 transition-colors disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </>
      )}
    </section>
  );
}
