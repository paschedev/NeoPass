'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  DollarSign,
  Ticket,
  ArrowLeft,
  Users,
  Check,
  Link2,
  Download,
  Search,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { toCsvCell } from '@/utils/csv';
import { formatCurrency, formatRelativeDate } from '@/utils/format';

export default function RppEventDetailsPage() {
  const { eventId } = useParams();
  const router = useRouter();

  const [stats, setStats] = useState({
    eventName: 'Cargando...',
    totalEarned: 0,
    totalTicketsSold: 0,
    clicks: 0,
    staffId: '',
    recentSales: [] as any[],
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredSales = stats.recentSales.filter((sale) =>
    sale.buyer.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  useEffect(() => {
    apiFetch(`/events/promoter/me/${eventId}/stats`)
      .then((res) => {
        if (!res.ok) throw new Error('Error cargando estadísticas');
        return res.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        toast.error('No se pudieron cargar las métricas');
        setLoading(false);
      });
  }, [eventId]);

  const handleCopy = () => {
    if (!stats.staffId) return;
    const baseUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:3000';
    const link = `${baseUrl}/eventos/${eventId}?rpp=${stats.staffId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success('¡Enlace copiado!');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleExportCSV = () => {
    if (filteredSales.length === 0) {
      toast.error('No hay ventas para exportar');
      return;
    }

    const headers = 'Comprador,Tickets,Precio Total,Comision,Fecha\n';
    const rows = filteredSales
      .map((sale) =>
        [
          sale.buyer,
          sale.tickets,
          sale.price,
          sale.commission,
          new Date(sale.date).toLocaleString('es-AR'),
        ]
          .map(toCsvCell)
          .join(','),
      )
      .join('\n');

    const blob = new Blob([headers + rows], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `ventas_${stats.eventName.replace(/\s+/g, '_').toLowerCase()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Planilla descargada');
  };

  if (loading)
    return (
      <div className="text-center py-20 text-neutral-400">
        Cargando métricas...
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto px-4 pt-8 pb-28 md:pb-8 flex flex-col md:h-[calc(100vh-64px)]">
      {/* Header */}
      <div className="shrink-0 flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-outfit text-3xl font-bold text-white mb-1">
              Métricas del Evento
            </h1>
            <p className="text-sm text-neutral-400">{stats.eventName}</p>
          </div>
        </div>
        <button
          onClick={handleCopy}
          disabled={!stats.staffId}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {copiedLink ? (
            <Check className="w-4 h-4" />
          ) : (
            <Link2 className="w-4 h-4" />
          )}
          Copiar Link
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-emerald-400/80 text-sm font-medium mb-1">
              Dinero Generado
            </h3>
            <div className="text-3xl lg:text-4xl font-outfit font-bold tracking-tight text-emerald-400">
              {formatCurrency(stats.totalEarned)}
            </div>
          </div>
          <div className="p-3 bg-emerald-500/20 rounded-2xl shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-400" />
          </div>
        </div>
        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 relative overflow-hidden flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-indigo-400/80 text-sm font-medium mb-1">
              Tickets Vendidos
            </h3>
            <div className="text-3xl lg:text-4xl font-outfit font-bold tracking-tight text-indigo-400">
              {stats.totalTicketsSold}
            </div>
          </div>
          <div className="p-3 bg-indigo-500/20 rounded-2xl shrink-0">
            <Ticket className="w-6 h-6 text-indigo-400" />
          </div>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl p-5 relative overflow-hidden flex items-center justify-between">
          <div className="flex flex-col">
            <h3 className="text-purple-400/80 text-sm font-medium mb-1">
              Visitas a tu link
            </h3>
            <div className="text-3xl lg:text-4xl font-outfit font-bold tracking-tight text-purple-400">
              {stats.clicks.toLocaleString('es-AR')}
            </div>
          </div>
          <div className="p-3 bg-purple-500/20 rounded-2xl shrink-0">
            <Users className="w-6 h-6 text-purple-400" />
          </div>
        </div>
      </div>

      {/* Sales Log */}
      <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">Registro de Ventas</h2>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por comprador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-xl"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Exportar Planilla</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead className="bg-black/20 sticky top-0 z-10">
              <tr>
                <th className="py-4 px-6 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Comprador
                </th>
                <th className="py-4 px-6 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Tickets
                </th>
                <th className="py-4 px-6 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Precio
                </th>
                <th className="py-4 px-6 text-xs font-bold text-emerald-500/70 uppercase tracking-wider">
                  Tu Comisión
                </th>
                <th className="py-4 px-6 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredSales.map((sale) => (
                <tr
                  key={sale.id}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-4 px-6">
                    <span className="font-medium text-white">{sale.buyer}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-neutral-300">{sale.tickets}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-neutral-300">
                      {formatCurrency(sale.price)}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-emerald-400 font-medium">
                      +{formatCurrency(sale.commission)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right text-sm text-neutral-500">
                    {formatRelativeDate(sale.date)}
                  </td>
                </tr>
              ))}

              {filteredSales.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-neutral-500"
                  >
                    No se encontraron ventas para este evento.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
