'use client';

import { useState, type FormEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import type { AdminList } from '@/hooks/useAdminList';

// Base de los botones de acción de las tarjetas; cada uno agrega su color.
export const ADMIN_ACTION =
  'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors';

const PAGER_BUTTON =
  'px-4 py-2 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-40';

function SearchForm({
  label,
  placeholder,
  search,
  onSearch,
}: {
  label: string;
  placeholder: string;
  search: string;
  onSearch: (q: string) => void;
}) {
  const [query, setQuery] = useState(search);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
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
  );
}

// Buscador, lista paginada de a 20 y sus estados (cargando, sin resultados,
// error), iguales en todas las pestañas del panel ADMIN.
export default function AdminListView<T extends { id: string }>({
  list,
  search,
  onSearch,
  searchLabel,
  searchPlaceholder,
  texts,
  pagerLabel,
  renderItem,
}: {
  list: AdminList<T>;
  search: string;
  onSearch: (q: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  texts: { loading: string; failed: string; empty: string; noMatches: string };
  pagerLabel: string;
  renderItem: (item: T) => ReactNode;
}) {
  const { data, failed, reload, page, setPage } = list;

  const renderList = () => {
    if (failed) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-10 text-center">
          <p className="text-neutral-300 mb-4">{texts.failed}</p>
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
        <p className="text-center py-12 text-neutral-500">{texts.loading}</p>
      );
    }
    if (data.items.length === 0) {
      return (
        <p className="text-center py-12 px-6 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed text-neutral-400">
          {search ? texts.noMatches : texts.empty}
        </p>
      );
    }

    const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
    return (
      <>
        <ul className="space-y-3">
          {data.items.map((item) => (
            <li key={item.id}>{renderItem(item)}</li>
          ))}
        </ul>
        <nav
          aria-label={pagerLabel}
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            onClick={() => setPage((current) => current - 1)}
            disabled={page <= 1}
            className={PAGER_BUTTON}
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
            className={PAGER_BUTTON}
          >
            Siguiente
          </button>
        </nav>
      </>
    );
  };

  return (
    <>
      {/* Se vuelve a montar con cada búsqueda: el atrás del navegador también
          cambia lo que dice el buscador. */}
      <SearchForm
        key={search}
        label={searchLabel}
        placeholder={searchPlaceholder}
        search={search}
        onSearch={onSearch}
      />
      {renderList()}
    </>
  );
}
