'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiFetch } from '@/utils/api';
import { optimizeCloudinaryUrl } from '@/utils/cloudinary';

const EVENTS_PER_PAGE = 24;

// What GET /events returns for each card.
type EventSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
  startDate: string;
  venueName: string | null;
};

export default function EventosPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    apiFetch(`/events?page=${page}&limit=${EVENTS_PER_PAGE}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { items: EventSummary[]; total: number }) => {
        setEvents((prev) =>
          page === 1 ? data.items : [...prev, ...data.items],
        );
        setTotal(data.total);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [page]);

  const filteredEvents = events.filter((event) => {
    const searchLower = searchTerm.toLowerCase();
    const titleMatch = event.title?.toLowerCase().includes(searchLower);
    const venueMatch = event.venueName?.toLowerCase().includes(searchLower);
    return titleMatch || venueMatch;
  });

  return (
    <div className="container mx-auto px-4 py-12 pt-6 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="font-outfit text-4xl md:text-5xl font-bold mb-3 text-white">
            Descubrir Eventos
          </h1>
          <p className="text-neutral-400 text-lg">
            Encuentra los mejores eventos cerca tuyo.
          </p>
        </div>

        <div className="relative w-full md:w-96 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-neutral-500 group-focus-within:text-indigo-400 transition-colors" />
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre o lugar..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition-all shadow-inner"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center text-neutral-400 py-20">
          Cargando eventos...
        </div>
      ) : loadError && events.length === 0 ? (
        <div className="text-center text-neutral-400 py-20">
          No pudimos cargar los eventos. Probá de nuevo en unos minutos.
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
          <p className="text-neutral-400 mb-6 text-lg">
            No hay eventos publicados en este momento.
          </p>
          <Link
            href="/"
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-white/10"
          >
            Volver al inicio
          </Link>
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {filteredEvents.map((event, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              key={event.id}
            >
              <Link
                href={`/eventos/${event.id}`}
                className="group block bg-black/40 border border-white/10 rounded-3xl overflow-hidden hover:border-indigo-500/50 transition-all hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 h-full flex flex-col"
              >
                <div className="h-56 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 relative overflow-hidden">
                  {event.imageUrl && (
                    <img
                      src={optimizeCloudinaryUrl(event.imageUrl, true)}
                      alt={event.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent group-hover:from-black/60 transition-colors duration-500" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white border border-white/10 flex items-center gap-2 shadow-lg">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    {new Date(event.startDate).toLocaleDateString('es-AR', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="font-outfit text-2xl font-bold mb-3 group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {event.title}
                  </h3>
                  <div className="mt-auto space-y-2">
                    <div className="flex items-center gap-2 text-sm text-neutral-400 font-medium">
                      <MapPin className="w-4 h-4 text-purple-400" />{' '}
                      <span className="truncate">
                        {event.venueName || 'Lugar por definir'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-400 font-medium">
                      <Calendar className="w-4 h-4 text-pink-400" />{' '}
                      {new Date(event.startDate).toLocaleTimeString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}

          {filteredEvents.length === 0 && searchTerm && (
            <div className="col-span-full text-center py-20 text-neutral-400">
              No se encontraron eventos para "{searchTerm}"
            </div>
          )}

          {events.length < total && (
            <div className="col-span-full flex justify-center">
              <button
                onClick={() => setPage((p) => p + 1)}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-white/10"
              >
                Ver más eventos
              </button>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
