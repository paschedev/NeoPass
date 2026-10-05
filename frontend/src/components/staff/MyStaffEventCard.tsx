'use client';

import { useId } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Check,
  Link2,
  MapPin,
  Navigation,
  ScanLine,
  Settings2,
} from 'lucide-react';
import { permissionsSummary } from '@/utils/co-organizers';
import type { EventPhase } from '@/utils/event-edit';
import { formatCurrency, formatWeekdayDateTime } from '@/utils/format';
import { getDirectionsUrl, hasMapLocation } from '@/utils/maps';
import { rppLink } from '@/utils/my-staff';
import { commissionLabel, eventPhaseLabel } from '@/utils/staff-overview';
import { ownRoleLabel } from '@/utils/staff-roles';
import toast from '@/utils/toast';
import type { MyPromoterRole, MyStaffEvent } from './types';

const PHASE_STYLES: Record<EventPhase, string> = {
  IN_PROGRESS: 'bg-emerald-500/15 text-emerald-300',
  NOT_STARTED: 'bg-indigo-500/15 text-indigo-300',
  CLOSED: 'bg-white/10 text-neutral-400',
};

const ACTION =
  'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="text-sm font-semibold text-white tabular-nums truncate">
        {value}
      </dd>
    </div>
  );
}

// Lo que te deben en este evento, visto desde el RPP.
function Owed({ balance }: { balance: number }) {
  if (balance > 0) {
    return (
      <div>
        <p className="text-xs text-neutral-500">Te deben</p>
        <p className="font-outfit text-xl font-bold text-emerald-400 tabular-nums">
          {formatCurrency(balance)}
        </p>
      </div>
    );
  }
  if (balance < 0) {
    return (
      <p className="text-xs text-neutral-400">
        Te pagaron {formatCurrency(-balance)} de más
      </p>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300">
      <Check className="w-3.5 h-3.5" /> Al día
    </span>
  );
}

function PromoterRole({
  event,
  promoter,
}: {
  event: MyStaffEvent;
  promoter: MyPromoterRole;
}) {
  const commission = commissionLabel(
    promoter.commissionType,
    promoter.commissionValue,
  );

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        rppLink(window.location.origin, event.id, promoter.staffId),
      );
      toast.success('Link copiado');
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  return (
    <div className="mt-4 bg-black/30 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-400">Como RPP</p>
        {commission && (
          <span className="px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-500/15 text-indigo-300">
            {commission}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 my-3">
        <Stat label="Vendidas" value={String(promoter.ticketsSold)} />
        <Stat label="Ganaste" value={formatCurrency(promoter.totalEarned)} />
        <Stat label="Te pagaron" value={formatCurrency(promoter.totalPaid)} />
      </dl>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Owed balance={promoter.balance} />
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/panel/rpp/${event.id}`}
            className={`${ACTION} bg-white/10 hover:bg-white/20 text-white`}
          >
            <BarChart3 className="w-4 h-4" /> Ver mis ventas
          </Link>
          {event.phase !== 'CLOSED' && (
            <button
              type="button"
              onClick={copyLink}
              className={`${ACTION} bg-indigo-600 hover:bg-indigo-500 text-white`}
            >
              <Link2 className="w-4 h-4" /> Copiar link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Un evento donde trabajás: cuándo y dónde, quién organiza y qué hacés ahí.
export default function MyStaffEventCard({ event }: { event: MyStaffEvent }) {
  const titleId = useId();
  const scans = event.roles.some((role) => role !== 'PROMOTER');
  const place = [event.venueName, event.venueAddress]
    .filter(Boolean)
    .join(' · ');

  return (
    <article
      aria-labelledby={titleId}
      className="bg-neutral-900 border border-white/5 rounded-3xl p-5 md:p-6 shadow-2xl"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span
          className={`px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${PHASE_STYLES[event.phase]}`}
        >
          {eventPhaseLabel(event)}
        </span>
        <span className="text-xs text-neutral-400">
          {formatWeekdayDateTime(event.startDate)}
        </span>
        {event.roles.map((role) => (
          <span
            key={role}
            className="px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase bg-white/10 text-white"
          >
            {ownRoleLabel(role)}
          </span>
        ))}
      </div>
      <h3
        id={titleId}
        className="font-outfit text-xl font-bold text-white break-words"
      >
        {event.title}
      </h3>
      <p className="text-xs text-neutral-500 mt-1">
        Organiza {event.organizerName}
      </p>
      {(place || hasMapLocation(event)) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-neutral-400">
          {place && (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{place}</span>
            </span>
          )}
          {hasMapLocation(event) && (
            <a
              href={getDirectionsUrl(event)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-indigo-300 hover:text-indigo-200"
            >
              <Navigation className="w-3.5 h-3.5" /> Cómo llegar
            </a>
          )}
        </div>
      )}

      {event.coOrganizer && (
        <div className="mt-4 bg-black/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-400">
              Como co-organizador
            </p>
            <p className="text-sm text-neutral-200 mt-1">
              Podés:{' '}
              {permissionsSummary(
                event.coOrganizer.permissions,
                event.coOrganizer.freeTicketLimit,
              )}
            </p>
          </div>
          <Link
            href={`/panel/eventos/${event.id}`}
            className={`${ACTION} bg-white/10 hover:bg-white/20 text-white shrink-0`}
          >
            <Settings2 className="w-4 h-4" /> Gestionar
          </Link>
        </div>
      )}

      {event.promoter && (
        <PromoterRole event={event} promoter={event.promoter} />
      )}

      {scans && event.phase === 'IN_PROGRESS' && (
        <Link
          href="/panel/escanear"
          className={`${ACTION} mt-4 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white`}
        >
          <ScanLine className="w-4 h-4" /> Escanear
        </Link>
      )}
      {scans && event.phase === 'NOT_STARTED' && (
        <p className="mt-4 text-xs text-neutral-500">
          Cuando empiece el evento vas a poder escanear las entradas desde acá
          o con el botón QR.
        </p>
      )}
    </article>
  );
}
