import { ArrowRightLeft, Calendar, MapPin } from 'lucide-react';
import { formatEventDate, isVoidTicket, type MyTicket } from './types';

export default function TicketCard({
  ticket,
  onOpen,
}: {
  ticket: MyTicket;
  onOpen: () => void;
}) {
  const { event } = ticket.ticketType;
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
          {ticket.status === 'VALID' ? (
            <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/20">
              VÁLIDA
            </div>
          ) : isVoidTicket(ticket.status) ? (
            <div className="bg-white/5 text-neutral-400 px-3 py-1 rounded-full text-xs font-bold border border-white/10">
              ANULADA
            </div>
          ) : (
            <div className="bg-red-500/10 text-red-400 px-3 py-1 rounded-full text-xs font-bold border border-red-500/20">
              UTILIZADA
            </div>
          )}
        </div>

        <h3 className="font-outfit text-2xl font-bold text-white mb-4 line-clamp-2">
          {event.title}
        </h3>

        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-3 text-sm text-neutral-400">
            <Calendar className="w-4 h-4 text-indigo-400" />
            {formatEventDate(event.startDate)}
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
            Ver Entrada{' '}
            <ArrowRightLeft className="w-3 h-3 opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-1 transition-all" />
          </div>
        </div>
      </div>
    </button>
  );
}
