'use client';

import { useEffect, useState } from 'react';
import type { AdminPage } from '@/components/admin/types';
import { apiFetch } from '@/utils/api';

// Una lista del panel ADMIN: pide la página de la búsqueda y, después de una
// acción, cambia un registro en el lugar sin volver a pedir la lista.
export function useAdminList<T extends { id: string }>(
  path: string,
  search: string,
) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminPage<T> | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);

  // Otra búsqueda arranca de la primera página. Mientras llega, queda la
  // lista anterior: nada salta.
  const [searched, setSearched] = useState(search);
  if (search !== searched) {
    setSearched(search);
    setPage(1);
    setFailed(false);
  }

  useEffect(() => {
    let current = true;
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    params.set('page', String(page));
    apiFetch(`${path}?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET ${path} ${res.status}`);
        return (await res.json()) as AdminPage<T>;
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
  }, [path, search, page, version]);

  const reload = () => {
    setFailed(false);
    setVersion((count) => count + 1);
  };

  const updateItem = (id: string, changes: Partial<T>) => {
    setData(
      (current) =>
        current && {
          ...current,
          items: current.items.map((item) =>
            item.id === id ? { ...item, ...changes } : item,
          ),
        },
    );
  };

  return { data, failed, reload, page, setPage, updateItem };
}

export type AdminList<T extends { id: string }> = ReturnType<
  typeof useAdminList<T>
>;
