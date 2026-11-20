'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
      {/* Una franja con divisiones: en el celular los ingresos ocupan la
          primera fila (el número más largo) y las otras tres van debajo. */}
      <dl className="grid grid-cols-3 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden mb-10">
        <MetricCard
          title="Ingresos totales"
          value={formatCurrency(stats.totalRevenue)}
          className="col-span-3 lg:col-span-1"
        />
        <MetricCard
          title="Entradas vendidas"
          value={stats.totalTicketsSold.toString()}
        />
        <MetricCard
          title="Eventos activos"
          value={stats.activeEvents.toString()}
        />
        <MetricCard
          title="Eventos totales"
          value={stats.totalEvents.toString()}
        />
      </dl>

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
