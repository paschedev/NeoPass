'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  Link2,
  MapPin,
  Pencil,
  Trash2,
} from 'lucide-react';
import DeleteEventModal from '@/components/events/DeleteEventModal';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { canEditEvent, type EventAccess } from '@/utils/co-organizers';
import toast from '@/utils/toast';
import {
  closedEventLabel,
  getEventPhase,
  isEventPublic,
} from '@/utils/event-edit';
import { formatEventRange } from '@/utils/format';
import { eventStatusBadge } from '@/utils/event-status';
import { copyLink, eventLink } from '@/utils/share';

// Encabezado del detalle: qué evento es, cuándo y dónde, y lo que puede hacer
// con él quien está en sesión (el dueño o un co-organizador). Solo el dueño lo
// puede eliminar.
export default function EventDetailHeader({
  event,
  access,
  ticketsSold,
}: {
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    deletedAt: string | null;
    venueName: string | null;
  };
  access: EventAccess;
  ticketsSold: number;
}) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [deleting, setDeleting] = useState(false);
  const now = new Date();
  const phase = getEventPhase(event, now);
  const isPublic = isEventPublic(event, now);
  const isOwner = access.role === 'OWNER';
  const canDelete = isOwner && !event.deletedAt && !!user;
  const badge = eventStatusBadge(event);

  return (
    <div className="space-y-8">
      <Link
        href={isOwner ? '/panel?tab=events' : '/panel/staff'}
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />{' '}
        {isOwner ? 'Volver a mis eventos' : 'Volver a Staff'}
      </Link>

      {/* Las acciones van debajo del título: al costado, en pantallas medianas lo aplastaban. */}
      <header className="flex flex-col gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${badge.className}`}
            >
              {badge.label}
            </span>
            {!isOwner && (
              <span className="inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase bg-sky-500/15 text-sky-300">
                Co-organizador
              </span>
            )}
          </div>
          <h1 className="font-outfit text-3xl font-bold text-white break-words">
            {event.title}
          </h1>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-neutral-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 shrink-0" />
              {formatEventRange(event.startDate, event.endDate)}
            </span>
            {event.venueName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {event.venueName}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          {phase === 'CLOSED' ? (
            <span className="text-center bg-white/5 text-neutral-500 px-5 py-2.5 rounded-xl text-sm font-medium">
              {closedEventLabel(event)}
            </span>
          ) : (
            canEditEvent(access) && (
              <Link
                href={`/panel/eventos/${event.id}/editar`}
                className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Pencil className="w-4 h-4" /> Editar evento
              </Link>
            )
          )}
          {isPublic && (
            <>
              <button
                type="button"
                onClick={() =>
                  copyLink(eventLink(window.location.origin, event.id))
                }
                className="inline-flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <Link2 className="w-4 h-4" /> Copiar link
              </button>
              <Link
                href={`/eventos/${event.id}`}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Ver página pública <ExternalLink className="w-4 h-4" />
              </Link>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="inline-flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Eliminar evento
            </button>
          )}
        </div>
      </header>

      {canDelete && user && (
        <DeleteEventModal
          event={event}
          open={deleting}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            toast.success('Evento eliminado');
            router.push('/panel?tab=events');
          }}
          asOrganizer={{
            ticketsSold,
            name: user.name,
            accountEmail: user.email,
          }}
        />
      )}
    </div>
  );
}
