'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/utils/api';
import {
  allowsFreeTicketType,
  chosenFreeTicketTypes,
  eventTicketTypeNames,
} from '@/utils/free-tickets';

export interface FreeTicketTypesChoice {
  // Los tipos del evento; null mientras cargan o si no se pudieron cargar.
  names: string[] | null;
  failed: boolean;
  isChosen: (name: string) => boolean;
  toggle: (name: string) => void;
  // Reemplaza lo tildado (al abrir otro co-organizador o después de invitar).
  select: (types: string[]) => void;
  // Lo tildado que el evento tiene hoy, en su orden: lo que se manda.
  chosen: string[];
}

// Qué tipos de entrada puede regalar alguien como QR free. Trae los del
// evento (GET /events/organizer/:id) solo cuando hace falta, es decir con un
// eventId, y arranca con los que ya tenía tildados.
export function useFreeTicketTypes(
  eventId: string | null,
  initial: string[] = [],
): FreeTicketTypesChoice {
  const [selected, setSelected] = useState(initial);
  const [loaded, setLoaded] = useState<{
    eventId: string;
    names: string[] | null;
  } | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let current = true;
    apiFetch(`/events/organizer/${eventId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET event ${res.status}`);
        const event = (await res.json()) as {
          ticketBatches: { ticketTypes: { name: string }[] }[];
        };
        return eventTicketTypeNames(event.ticketBatches);
      })
      .then((names) => {
        if (current) setLoaded({ eventId, names });
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setLoaded({ eventId, names: null });
      });
    return () => {
      current = false;
    };
  }, [eventId]);

  const ready = loaded !== null && loaded.eventId === eventId;
  const names = ready ? loaded.names : null;
  return {
    names,
    failed: ready && loaded.names === null,
    isChosen: (name) => allowsFreeTicketType(selected, name),
    toggle: (name) =>
      setSelected((current) =>
        allowsFreeTicketType(current, name)
          ? current.filter((type) => !allowsFreeTicketType([type], name))
          : [...current, name],
      ),
    select: setSelected,
    chosen: names ? chosenFreeTicketTypes(selected, names) : [],
  };
}
