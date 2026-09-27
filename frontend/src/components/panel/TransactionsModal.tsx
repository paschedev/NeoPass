'use client';

import { useState } from 'react';
import { Activity, Search, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { formatCurrency, formatRelativeDate } from '@/utils/format';
import type { Transaction } from './types';

export default function TransactionsModal({
  open,
  onClose,
  transactions,
}: {
  open: boolean;
  onClose: () => void;
  transactions: Transaction[];
}) {
  const [search, setSearch] = useState('');
  const term = search.toLowerCase();
  const filtered = transactions.filter(
    (sale) =>
      sale.name.toLowerCase().includes(term) ||
      sale.event.toLowerCase().includes(term),
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="transactions-title"
      className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-lg h-[700px] max-h-[85vh] flex flex-col relative shadow-2xl"
    >
      <button
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full hover:bg-white/10 z-10"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="shrink-0">
        <h2
          id="transactions-title"
          className="text-2xl font-bold mb-6 flex items-center gap-2 pr-8"
        >
          <Activity className="w-6 h-6 text-emerald-400" />
          Historial de Transacciones
        </h2>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o evento..."
            className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto overscroll-contain pr-2">
        {filtered.map((sale, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neutral-800 to-neutral-700 border border-white/10 flex items-center justify-center font-bold text-sm text-neutral-300">
                {sale.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="font-medium text-sm text-white">
                  {sale.name}
                </div>
                <div className="text-xs text-neutral-500">{sale.event}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-sm text-white">
                {formatCurrency(sale.amount)}
              </div>
              <div
                className={`text-xs ${sale.status === 'PAID' ? 'text-emerald-400' : 'text-red-400'} bg-black/40 px-2 py-0.5 rounded-full inline-block mt-1`}
              >
                {sale.status === 'PAID' ? 'Aprobada' : 'Rechazada'}
              </div>
              <div className="text-[10px] text-neutral-500 mt-1">
                {formatRelativeDate(sale.time)}
              </div>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-6 text-sm text-neutral-500">
            Aún no hay transacciones.
          </div>
        )}
      </div>
    </Modal>
  );
}
