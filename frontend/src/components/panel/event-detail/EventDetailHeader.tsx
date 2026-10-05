import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ExternalLink,
  MapPin,
  Pencil,
} from 'lucide-react';
import { canEditEvent, type EventAccess } from '@/utils/co-organizers';
import { closedEventLabel, getEventPhase } from '@/utils/event-edit';
import {
  DEFAULT_STATUS_STYLE,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_STYLES,
} from '@/utils/event-status';

// Encabezado del detalle: qué evento es, cuándo y dónde, y lo que puede hacer
// con él quien está en sesión (el dueño o un co-organizador).
export default function EventDetailHeader({
  event,
  access,
}: {
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    venueName: string | null;
  };
  access: EventAccess;
}) {
  const phase = getEventPhase(event, new Date());
  const isPublic = event.status === 'PUBLISHED' && phase !== 'CLOSED';
  const isOwner = access.role === 'OWNER';

  return (
    <div className="space-y-8">
      <Link
        href={isOwner ? '/panel?tab=events' : '/panel/staff'}
        className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />{' '}
        {isOwner ? 'Volver a mis eventos' : 'Volver a Staff'}
      </Link>

      <header className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <span
              className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${EVENT_STATUS_STYLES[event.status] ?? DEFAULT_STATUS_STYLE}`}
            >
              {EVENT_STATUS_LABELS[event.status] ?? event.status}
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
              <Calendar className="w-4 h-4" />
              {new Date(event.startDate).toLocaleString('es-AR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {event.venueName && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" /> {event.venueName}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          {phase === 'CLOSED' ? (
            <span className="text-center bg-white/5 text-neutral-500 px-5 py-2.5 rounded-xl text-sm font-medium">
              {closedEventLabel(event.status)}
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
            <Link
              href={`/eventos/${event.id}`}
              target="_blank"
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              Ver página pública <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>
    </div>
  );
}
