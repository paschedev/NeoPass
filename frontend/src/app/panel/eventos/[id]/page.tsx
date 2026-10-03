'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import EventSalesView from '@/components/panel/event-detail/EventSalesView';
import PromoterPayouts from '@/components/panel/event-detail/PromoterPayouts';
import CheckInProgress from '@/components/panel/event-detail/CheckInProgress';
import AttendeeList from '@/components/panel/event-detail/AttendeeList';
import type { EventSales } from '@/components/panel/event-detail/types';
import { apiFetch } from '@/utils/api';
import { getEventPhase } from '@/utils/event-edit';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; sales: EventSales }
  | { state: 'missing' }
  | { state: 'failed' };

// Detalle del evento para su organizador: ventas, ingreso en puerta, RPPs y
// asistentes. Reemplaza el "Ver página" de Mis eventos.
export default function EventDetailPage() {
  const { id } = useParams();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    apiFetch(`/events/organizer/${id}/sales`)
      .then(async (res): Promise<Loaded> => {
        // Un evento ajeno (403) o inexistente (404) se ve igual.
        if (res.status === 403 || res.status === 404)
          return { state: 'missing' };
        if (!res.ok) throw new Error(`GET sales ${res.status}`);
        return { state: 'ready', sales: (await res.json()) as EventSales };
      })
      .catch((error: unknown): Loaded => {
        console.error(error);
        return { state: 'failed' };
      })
      .then((result) => {
        if (current) setLoaded(result);
      });
    return () => {
      current = false;
    };
  }, [id, attempt]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-0 pt-8 md:pt-12 pb-24 md:pb-12">
      {loaded.state === 'loading' && (
        <p className="text-center py-20 text-neutral-400">
          Cargando el evento...
        </p>
      )}
      {loaded.state === 'missing' && (
        <p className="text-center py-20 text-neutral-400">
          No encontramos este evento.
        </p>
      )}
      {loaded.state === 'failed' && (
        <div className="text-center py-20 space-y-4">
          <p className="text-neutral-400">No pudimos cargar el evento.</p>
          <button
            type="button"
            onClick={() => {
              setLoaded({ state: 'loading' });
              setAttempt((count) => count + 1);
            }}
            className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}
      {loaded.state === 'ready' && (
        <div className="space-y-10">
          <EventSalesView sales={loaded.sales} />
          <CheckInProgress
            eventId={loaded.sales.event.id}
            live={
              getEventPhase(loaded.sales.event, new Date()) === 'IN_PROGRESS'
            }
          />
          <PromoterPayouts eventId={loaded.sales.event.id} />
          <AttendeeList eventId={loaded.sales.event.id} />
        </div>
      )}
    </div>
  );
}
