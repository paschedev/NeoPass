'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar as CalendarIcon,
  DollarSign,
  Library,
  Ticket,
} from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import MetricCard from './MetricCard';
import RecentSales from './RecentSales';
import SalesChart from './SalesChart';
import TransactionsModal from './TransactionsModal';
import type { DashboardStats } from './types';

// Pestaña "Resumen" del panel del organizador.
export default function DashboardTab({ stats }: { stats: DashboardStats }) {
  const [showTransactions, setShowTransactions] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          title="Ingresos Totales"
          value={formatCurrency(stats.totalRevenue)}
          icon={<DollarSign className="text-emerald-400 w-6 h-6" />}
          color="emerald"
        />
        <MetricCard
          title="Entradas Vendidas"
          value={stats.totalTicketsSold.toString()}
          icon={<Ticket className="text-indigo-400 w-6 h-6" />}
          color="indigo"
        />
        <MetricCard
          title="Eventos Activos"
          value={stats.activeEvents.toString()}
          icon={<CalendarIcon className="text-purple-400 w-6 h-6" />}
          color="purple"
        />
        <MetricCard
          title="Eventos Totales"
          value={stats.totalEvents.toString()}
          icon={<Library className="text-blue-400 w-6 h-6" />}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SalesChart points={stats.chartData} />
        <RecentSales
          transactions={stats.recentTransactions}
          onShowAll={() => setShowTransactions(true)}
        />
      </div>

      <TransactionsModal
        open={showTransactions}
        onClose={() => setShowTransactions(false)}
        transactions={stats.recentTransactions}
      />
    </motion.div>
  );
}
