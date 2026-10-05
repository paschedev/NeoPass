'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import EventDetailHeader from '@/components/panel/event-detail/EventDetailHeader';
import EventSalesView from '@/components/panel/event-detail/EventSalesView';
import PromoterPayouts from '@/components/panel/event-detail/PromoterPayouts';
import FreeTickets from '@/components/panel/event-detail/FreeTickets';
import CheckInProgress from '@/components/panel/event-detail/CheckInProgress';
import AttendeeList from '@/components/panel/event-detail/AttendeeList';
import CoOrganizers from '@/components/panel/event-detail/CoOrganizers';
import EventActivity from '@/components/panel/event-detail/EventActivity';
import LockedSection from '@/components/panel/event-detail/LockedSection';
import type {
  EventSales,
  TeamEvent,
} from '@/components/panel/event-detail/types';
import { apiFetch } from '@/utils/api';
import { can } from '@/utils/co-organizers';
import { getEventPhase } from '@/utils/event-edit';
import { freeTicketsBlockedReason } from '@/utils/free-tickets';

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; event: TeamEvent; sales: EventSales | null }
  | { state: 'missing' }
  | { state: 'failed' };

// Los tipos de entrada que se pueden mandar como QR free: "General · Preventa".
function ticketTypeOptions(event: TeamEvent) {
  return event.ticketBatches.flatMap((batch) =>
    batch.ticketTypes.map((type) => ({
      id: type.id,
      label: `${type.name} · ${batch.name}`,
    })),
  );
}

// Primero el evento con lo que puede hacer quien lo abre; las ventas, solo si
// las puede ver.
async function loadEvent(id: string): Promise<Loaded> {
  const res = await apiFetch(`/events/organizer/${id}`);
  // Un evento ajeno (403) o inexistente (404) se ve igual.
  if (res.status === 403 || res.status === 404) return { state: 'missing' };
  if (!res.ok) throw new Error(`GET event ${res.status}`);
  const event = (await res.json()) as TeamEvent;
  if (!can(event.access, 'VIEW_SALES')) {
    return { state: 'ready', event, sales: null };
  }
  const salesRes = await apiFetch(`/events/organizer/${id}/sales`);
  if (!salesRes.ok) throw new Error(`GET sales ${salesRes.status}`);
  return {
    state: 'ready',
    event,
    sales: (await salesRes.json()) as EventSales,
  };
}

// Detalle del evento para quien lo organiza o lo co-organiza: ventas, ingreso
// en puerta, RPPs, QR free, asistentes y, solo para el dueño,
// co-organizadores e historial. Un co-organizador ve bloqueado lo que no
// tiene permitido.
export default function EventDetailPage() {
  const { id } = useParams();
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    loadEvent(String(id))
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
        <EventSections event={loaded.event} sales={loaded.sales} />
      )}
    </div>
  );
}

function EventSections({
  event,
  sales,
}: {
  event: TeamEvent;
  sales: EventSales | null;
}) {
  const { access } = event;
  const phase = getEventPhase(event, new Date());
  const open = phase !== 'CLOSED';
  const ticketTypes = ticketTypeOptions(event);

  return (
    <div className="space-y-10">
      <EventDetailHeader event={event} access={access} />
      {sales ? (
        <EventSalesView sales={sales} />
      ) : (
        <LockedSection title="Ventas" permission="VIEW_SALES" />
      )}
      <CheckInProgress eventId={event.id} live={phase === 'IN_PROGRESS'} />
      {can(access, 'MANAGE_STAFF') ? (
        <PromoterPayouts
          eventId={event.id}
          inviteEvent={open ? { id: event.id, title: event.title } : undefined}
        />
      ) : (
        <LockedSection title="RPPs" permission="MANAGE_STAFF" />
      )}
      {can(access, 'SEND_FREE_TICKETS') ? (
        <FreeTickets
          eventId={event.id}
          event={event}
          ticketTypes={ticketTypes}
          sendBlockedReason={freeTicketsBlockedReason(
            event,
            ticketTypes.length,
            new Date(),
          )}
          limit={access.freeTicketLimit}
          ownerId={access.role === 'OWNER' ? event.organizerId : null}
        />
      ) : (
        <LockedSection title="QR free" permission="SEND_FREE_TICKETS" />
      )}
      {can(access, 'VIEW_ATTENDEES') ? (
        <AttendeeList eventId={event.id} />
      ) : (
        <LockedSection title="Asistentes" permission="VIEW_ATTENDEES" />
      )}
      {access.role === 'OWNER' && (
        <>
          <CoOrganizers event={event} canInvite={open} />
          <EventActivity eventId={event.id} />
        </>
      )}
    </div>
  );
}
