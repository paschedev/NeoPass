'use client';

import {
  DollarSign,
  Ticket,
  Activity,
  TrendingUp,
  Calendar as CalendarIcon,
  Link2,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { canSeeRppPanel } from '@/utils/roles';

export default function RppDashboard() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [stats, setStats] = useState({
    totalEarned: 0,
    totalPaid: 0,
    totalTicketsSold: 0,
  });
  const [copiedLink, setCopiedLink] = useState('');
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!canSeeRppPanel(user)) {
      router.push('/panel');
      return;
    }

    // Carga de metricas reales
    apiFetch('/events/promoter/me')
      .then((res) => res.json())
      .then((data) => {
        setStats({
          totalEarned: data.totalEarned || 0,
          totalPaid: data.totalPaid || 0,
          totalTicketsSold: data.totalTicketsSold || 0,
        });
        const mappedEvents = (data.events || []).map((es: any) => ({
          id: es.eventId,
          staffId: es.id,
          name: es.event.title,
          status: es.event.status === 'PUBLISHED' ? 'Activo' : 'Inactivo',
          sold: es.totalTicketsSold || 0,
          earned: Number(es.totalEarned || 0),
          commission:
            es.commissionType === 'FIXED'
              ? `$${es.commissionValue}`
              : `${es.commissionValue}%`,
        }));
        setEvents(mappedEvents);
      })
      .catch(console.error);
  }, [user, router]);

  const handleCopy = (eventId: string, staffId: string) => {
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    const link = `${baseUrl}/eventos/${eventId}?rpp=${staffId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(eventId);
    toast.success('¡Enlace de referido copiado!');
    setTimeout(() => setCopiedLink(''), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 pt-8 pb-24 md:pb-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-outfit text-4xl font-bold text-white mb-2">
          Mi Panel de Promotor
        </h1>
        <p className="text-neutral-400">
          Rastrea tus ventas, ganancias y enlaces de afiliado.
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <MetricCard
          title="Dinero Total Generado"
          value={formatCurrency(stats.totalEarned)}
          icon={<DollarSign className="text-emerald-400 w-6 h-6" />}
          color="emerald"
        />
        <MetricCard
          title="Tickets Vendidos (Histórico)"
          value={stats.totalTicketsSold.toString()}
          icon={<Ticket className="text-indigo-400 w-6 h-6" />}
          color="indigo"
        />
      </div>

      {/* RPP Events List */}
      <div className="bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="hidden md:block absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

        <h2 className="font-outfit text-2xl font-bold mb-6 relative z-10">
          Mis Eventos Asignados
        </h2>

        <div className="grid gap-4 relative z-10">
          {events.map((ev) => (
            <div
              key={ev.id}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 transition-all hover:bg-white/10"
            >
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg text-white">{ev.name}</h3>
                  <span
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ev.status === 'Activo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-neutral-500/20 text-neutral-400'}`}
                  >
                    {ev.status}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Ticket className="w-4 h-4" /> {ev.sold} vendidos
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />{' '}
                    {formatCurrency(ev.earned)} generados
                  </span>
                  <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-md text-white font-medium">
                    Comisión: {ev.commission}
                  </span>
                </div>
              </div>

              <div className="w-full md:w-auto flex flex-col md:flex-row gap-3">
                <button
                  onClick={() => {
                    setNavigatingId(ev.id);
                    router.push(`/panel/rpp/${ev.id}`);
                  }}
                  disabled={navigatingId === ev.id}
                  className="w-full md:w-44 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95 disabled:opacity-50"
                >
                  {navigatingId === ev.id ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Activity className="w-5 h-5" />
                  )}
                  {navigatingId === ev.id ? 'Cargando...' : 'Ver Detalles'}
                </button>
                <button
                  disabled={ev.status !== 'Activo'}
                  onClick={() => handleCopy(ev.id, ev.staffId)}
                  className="w-full md:w-44 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap"
                >
                  {copiedLink === ev.id ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <Link2 className="w-5 h-5" />
                  )}
                  {copiedLink === ev.id ? '¡Copiado!' : 'Copiar Link'}
                </button>
              </div>
            </div>
          ))}

          {events.length === 0 && (
            <div className="text-center py-12 bg-white/[0.02] rounded-2xl border border-white/5 border-dashed">
              <CalendarIcon className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-neutral-400 mb-2">
                No tienes eventos activos
              </h3>
              <p className="text-sm text-neutral-500">
                Cuando un organizador te asigne como promotor, aparecerá aquí.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}) {
  const colorStyles: Record<string, string> = {
    emerald: 'bg-emerald-500/10 group-hover:bg-emerald-500/20',
    indigo: 'bg-indigo-500/10 group-hover:bg-indigo-500/20',
    purple: 'bg-purple-500/10 group-hover:bg-purple-500/20',
    blue: 'bg-blue-500/10 group-hover:bg-blue-500/20',
  };

  const bgStyle = colorStyles[color] || 'bg-white/10 group-hover:bg-white/20';

  return (
    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-5 relative overflow-hidden group hover:border-white/10 transition-all hover:-translate-y-1 shadow-xl flex items-center justify-between">
      <div
        className={`absolute top-0 right-0 w-32 h-32 ${bgStyle} rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-colors`}
      />
      <div className="relative z-10 flex flex-col">
        <div className="text-sm font-medium text-neutral-400 mb-1">{title}</div>
        <div className="font-outfit text-3xl lg:text-4xl font-bold tracking-tight text-white">
          {value}
        </div>
      </div>
      <div className="relative z-10 p-3 bg-white/5 rounded-2xl border border-white/5 shadow-inner shrink-0">
        {icon}
      </div>
    </div>
  );
}
