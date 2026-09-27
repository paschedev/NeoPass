'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';

export interface UserSearchResult {
  id: string;
  name: string;
  email: string;
}

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 300;

// Busca usuarios mientras se escribe (para invitar staff o transferir un
// ticket): espera a que se deje de tipear y descarta respuestas viejas.
export function useUserSearch(term: string): UserSearchResult[] {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const query = term.length >= MIN_LENGTH ? term : '';

  useEffect(() => {
    if (!query) return;
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `/auth/users/search?q=${encodeURIComponent(query)}`,
        );
        const found: UserSearchResult[] = res.ok ? await res.json() : [];
        if (current) setResults(found);
      } catch {
        // Sin conexión: se queda sin resultados, el usuario puede reintentar.
        if (current) setResults([]);
      }
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query]);

  return query ? results : [];
}
