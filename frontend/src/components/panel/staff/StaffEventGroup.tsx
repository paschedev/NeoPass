'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  ChevronUp,
  UserPlus,
} from 'lucide-react';
import type { EventPhase } from '@/utils/event-edit';
import { formatCurrency, formatWeekdayDateTime } from '@/utils/format';
import type { InviteRole } from '@/utils/staff-invitation';
import {
  eventPhaseLabel,
  lacksDoorStaff,
  staffCounts,
} from '@/utils/staff-overview';
import type { PaymentTarget } from '../event-detail/PromoterPaymentModal';
import type {
  StaffEventGroup as StaffEventGroupData,
  StaffPerson,
} from '../types';
import PromoterCard from './PromoterCard';
import StaffIdentity, { InvitationChip } from './StaffIdentity';

export interface InvitePreset {
  eventId: string;
  role?: InviteRole;
}

const PHASE_STYLES: Record<EventPhase, string> = {
  IN_PROGRESS: 'bg-emerald-500/15 text-emerald-300',
  NOT_STARTED: 'bg-indigo-500/15 text-indigo-300',
  CLOSED: 'bg-white/10 text-neutral-400',
};

const PILL_BUTTON =
  'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors';

const BLOCK_TITLE = 'text-xs font-semibold text-neutral-400 mb-3';

function EventDebt({ event }: { event: StaffEventGroupData }) {
  if (event.promoters.length === 0) {
    const hasStaff = event.scanners.length + event.managers.length > 0;
    return hasStaff ? (
      <span className="text-xs text-neutral-500">Sin RPPs</span>
    ) : null;
  }
  if (event.owed > 0) {
    return (
      <div className="sm:text-right shrink-0">
        <p className="text-xs text-neutral-500">Deuda del evento</p>
        <p className="font-outfit text-2xl font-bold text-amber-300 tabular-nums">
          {formatCurrency(event.owed)}
        </p>
      </div>
    );
  }
  return (
    <span className="self-start shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300">
      <Check className="w-3.5 h-3.5" /> Al día
    </span>
  );
}

function PeopleBlock({
  title,
  people,
}: {
  title: string;
  people: StaffPerson[];
}) {
  if (people.length === 0) return null;
  return (
    <div className="mt-6">
      <h4 className={BLOCK_TITLE}>
        {title} · {people.length}
      </h4>
      <ul
        aria-label={title}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2"
      >
        {people.map((person) => (
          <li
            key={person.id}
            className="bg-white/[0.03] border border-white/5 rounded-xl p-3"
          >
            <StaffIdentity
              name={person.name}
              email={person.email}
              aside={<InvitationChip status={person.status} />}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

// Un evento con su staff: RPPs (con lo que se les debe), scanners y
// encargados.
export default function StaffEventGroup({
  event,
  onInvite,
  onPay,
}: {
  event: StaffEventGroupData;
  onInvite: (preset: InvitePreset) => void;
  onPay: (target: PaymentTarget) => void;
}) {
  const titleId = useId();
  const contentId = useId();
  const [open, setOpen] = useState(true);
  const invitable = event.phase !== 'CLOSED';
  const hasStaff =
    event.promoters.length + event.scanners.length + event.managers.length > 0;

  return (
    <section
      aria-labelledby={titleId}
      className="bg-neutral-900 border border-white/5 rounded-3xl p-5 md:p-6 shadow-2xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${PHASE_STYLES[event.phase]}`}
            >
              {eventPhaseLabel(event)}
            </span>
            <span className="text-xs text-neutral-400">
              {formatWeekdayDateTime(event.startDate)}
            </span>
            {lacksDoorStaff(event) && (
              <button
                type="button"
                aria-label={`Sin scanners: invitar un scanner a ${event.title}`}
                onClick={() => onInvite({ eventId: event.id, role: 'SCANNER' })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 transition-colors"
              >
                <AlertTriangle className="w-3 h-3" /> Sin scanners
              </button>
            )}
          </div>
          <h3
            id={titleId}
            className="font-outfit text-xl font-bold text-white break-words"
          >
            {event.title}
          </h3>
          <p className="text-xs text-neutral-500 mt-1">{staffCounts(event)}</p>
        </div>
        <EventDebt event={event} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {invitable && (
          <button
            type="button"
            aria-label={`Invitar a ${event.title}`}
            onClick={() => onInvite({ eventId: event.id })}
            className={`${PILL_BUTTON} bg-white/10 hover:bg-white/20 text-white`}
          >
            <UserPlus className="w-4 h-4" /> Invitar
          </button>
        )}
        <Link
          href={`/panel/eventos/${event.id}`}
          className={`${PILL_BUTTON} bg-white/10 hover:bg-white/20 text-white`}
        >
          <BarChart3 className="w-4 h-4" /> Ver detalle
        </Link>
        {hasStaff && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen((current) => !current)}
            className={`${PILL_BUTTON} ml-auto text-neutral-400 hover:text-white hover:bg-white/5`}
          >
            {open ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
            {open ? 'Ocultar' : 'Ver staff'}
          </button>
        )}
      </div>

      {open && hasStaff && (
        <div id={contentId}>
          {event.promoters.length > 0 && (
            <div className="mt-6">
              <h4 className={BLOCK_TITLE}>RPPs · {event.promoters.length}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {event.promoters.map((promoter) => (
                  <PromoterCard
                    key={promoter.id}
                    promoter={promoter}
                    onPay={({ id, name, balance }) =>
                      onPay({ eventId: event.id, staffId: id, name, balance })
                    }
                  />
                ))}
              </div>
            </div>
          )}
          <PeopleBlock title="Scanners" people={event.scanners} />
          <PeopleBlock title="Encargados" people={event.managers} />
        </div>
      )}
    </section>
  );
}
