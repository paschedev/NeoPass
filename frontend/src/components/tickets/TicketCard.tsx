import { ArrowRightLeft, Calendar, MapPin } from 'lucide-react';
import { formatEventRange } from '@/utils/format';
import { ticketBadge, type TicketBadge } from '@/utils/my-tickets';
import type { MyTicket } from './types';

const MUTED_BADGE = 'bg-white/5 text-neutral-400 border-white/10';

const BADGES: Record<TicketBadge, { label: string; className: string }> = {
  VALID: {
    label: 'VÁLIDA',
    className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  EXPIRED: { label: 'VENCIDA', className: MUTED_BADGE },
  USED: {
    label: 'UTILIZADA',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  VOID: { label: 'ANULADA', className: MUTED_BADGE },
  DELETED: {
    label: 'EVENTO ELIMINADO',
    className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
};

export default function TicketCard({
  ticket,
  onOpen,
}: {
  ticket: MyTicket;
  onOpen: () => void;
}) {
  const { event } = ticket.ticketType;
  const badge = BADGES[ticketBadge(ticket, new Date())];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left bg-neutral-900 border border-white/10 rounded-3xl overflow-hidden cursor-pointer hover:border-indigo-500/50 hover:shadow-[0_0_30px_rgba(99,102,241,0.15)] transition-all relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="bg-white/10 rounded-lg px-3 py-1.5 text-xs font-semibold text-white tracking-wide">
            {ticket.ticketType.name}
          </div>
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.className}`}
          >
            {badge.label}
          </div>
        </div>

        <h3 className="font-outfit text-2xl font-bold text-white mb-4 line-clamp-2">
          {event.title}
        </h3>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <Calendar className="w-4 h-4 shrink-0 text-indigo-400" />
            {formatEventRange(event.startDate, event.endDate)}
          </div>
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <MapPin className="w-4 h-4 text-indigo-400" />
            {event.venueName || 'Lugar por definir'}
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 border-dashed flex items-center justify-between">
          <div className="text-xs text-neutral-500 font-mono">
            ID: {ticket.id.slice(-8).toUpperCase()}
          </div>
          <div className="text-sm font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors flex items-center gap-1">
            Ver entrada{' '}
            <ArrowRightLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-1 transition-all" />
          </div>
        </div>
      </div>
    </button>
  );
}
