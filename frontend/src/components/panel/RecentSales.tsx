import { formatCurrency, formatRelativeDate } from '@/utils/format';
import type { Transaction } from './types';

export default function RecentSales({
  transactions,
  onShowAll,
}: {
  transactions: Transaction[];
  onShowAll: () => void;
}) {
  return (
    <div className="bg-neutral-900 border border-white/5 rounded-3xl p-8 shadow-2xl">
      <h2 className="font-outfit text-xl font-bold mb-6">Últimas Ventas</h2>
      <div className="space-y-2">
        {transactions.slice(0, 5).map((sale, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-colors cursor-default border border-transparent hover:border-white/5"
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
              <div className="font-bold text-sm text-emerald-400">
                {formatCurrency(sale.amount)}
              </div>
              <div className="text-xs text-neutral-500">
                {formatRelativeDate(sale.time)}
              </div>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="text-center py-6 text-sm text-neutral-500">
            Aún no hay ventas recientes.
          </div>
        )}
      </div>
      <button
        onClick={onShowAll}
        className="w-full mt-6 py-3 text-sm font-medium text-neutral-400 hover:text-white bg-white/[0.02] hover:bg-white/5 rounded-xl transition-colors"
      >
        Ver todas las transacciones
      </button>
    </div>
  );
}
