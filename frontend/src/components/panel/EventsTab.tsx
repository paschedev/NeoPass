'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  ExternalLink,
  MapPin,
  X,
} from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import type { OrganizerEvent } from './types';

const STATUS_STYLES: Record<string, string> = {
  PUBLISHED: 'bg-emerald-500/10 text-emerald-400',
  DRAFT: 'bg-amber-500/10 text-amber-400',
};

function salesSummary(event: OrganizerEvent) {
  return event.ticketTypes.reduce(
    (summary, type) => ({
      sold: summary.sold + type.sold,
      revenue: summary.revenue + type.sold * Number(type.price),
    }),
    { sold: 0, revenue: 0 },
  );
}

// Pestaña "Mis Eventos" del panel del organizador.
export default function EventsTab({
  events,
  loading,
  error,
  onRetry,
}: {
  events: OrganizerEvent[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="font-outfit text-2xl font-bold">Mis Eventos</h2>
          <p className="text-sm text-neutral-400">
            Gestiona y analiza el rendimiento de tus eventos.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-neutral-400 py-10">
          Cargando eventos...
        </div>
      ) : error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Error al cargar eventos
          </h3>
          <p className="text-neutral-400 mb-6">
            Hubo un problema de conexión. Por favor, intenta nuevamente.
          </p>
          <button
            onClick={onRetry}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-colors font-medium"
          >
            Reintentar
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-neutral-900 border border-white/5 rounded-3xl p-12 text-center shadow-2xl">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarIcon className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Aún no tienes eventos
          </h3>
          <p className="text-neutral-400 mb-6">
            Crea tu primer evento y comienza a vender entradas ahora mismo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {events.map((event) => {
            const { sold, revenue } = salesSummary(event);
            return (
              <div
                key={event.id}
                className="bg-neutral-900 border border-white/5 rounded-3xl p-6 hover:border-white/10 transition-colors shadow-2xl"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2.5 py-1 text-[10px] font-semibold rounded-md uppercase ${STATUS_STYLES[event.status] ?? 'bg-white/10 text-neutral-400'}`}
                      >
                        {event.status === 'PUBLISHED'
                          ? 'PUBLICADO'
                          : event.status}
                      </span>
                      <span className="text-xs text-neutral-400">
                        {new Date(event.startDate).toLocaleDateString('es-AR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <h3 className="font-outfit text-xl font-bold text-white mb-2">
                      {event.title}
                    </h3>
                    <div className="flex items-center gap-4 text-xs text-neutral-400 mb-4">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {event.venueName || 'Lugar por definir'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <div className="text-xs text-neutral-500 mb-1">
                        Ingresos
                      </div>
                      <div className="text-lg font-bold text-emerald-400">
                        {formatCurrency(revenue)}
                      </div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <div className="text-xs text-neutral-500 mb-1">
                        Entradas Vendidas
                      </div>
                      <div className="text-lg font-bold text-white">{sold}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-white/5">
                  <Link
                    href={`/panel/eventos/${event.id}/editar`}
                    className="flex-1 text-center bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    Editar Evento
                  </Link>
                  <Link
                    href={`/eventos/${event.id}`}
                    target="_blank"
                    className="flex-1 text-center bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    Ver Página <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
