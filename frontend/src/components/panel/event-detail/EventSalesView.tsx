import type { ReactNode } from 'react';
import { Ticket } from 'lucide-react';
import { BATCH_STATUS_BADGES } from '@/utils/batches';
import { formatCurrency } from '@/utils/format';
import type { EventSales } from './types';

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
}) {
  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-4">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {detail && <div className="text-xs text-neutral-500 mt-1">{detail}</div>}
    </div>
  );
}

const NUMBER_CELL = 'px-3 py-3 text-right tabular-nums whitespace-nowrap';

// Ventas de un evento: resumen y ventas de cada tanda y tipo de entrada. El
// encabezado del evento va aparte (EventDetailHeader).
export default function EventSalesView({ sales }: { sales: EventSales }) {
  const { totals, batches } = sales;

  return (
    <div className="space-y-8">
      <section
        aria-label="Resumen"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <SummaryCard
          label="Recaudado"
          value={formatCurrency(totals.revenue)}
          detail="Lo que pagaron los compradores por las entradas. Mercado Pago descuenta su comisión al acreditarte."
        />
        <SummaryCard
          label="Entradas vendidas"
          value={`${totals.sold} de ${totals.capacity}`}
          detail={
            totals.reserved > 0
              ? `${totals.reserved} en proceso de pago`
              : undefined
          }
        />
        <SummaryCard
          label="Ingresaron"
          value={`${totals.checkedIn} de ${totals.sold}`}
        />
        <SummaryCard
          label="Devoluciones"
          value={String(totals.refundedOrders)}
          detail="Compras devueltas o con contracargo"
        />
      </section>

      <div className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Ticket className="w-5 h-5 text-pink-400" /> Ventas por tanda
        </h2>
        {batches.length === 0 ? (
          <p className="text-neutral-400 text-sm">
            Este evento todavía no tiene tandas.
          </p>
        ) : (
          batches.map((batch) => {
            const badge = BATCH_STATUS_BADGES[batch.saleStatus];
            return (
              <section
                key={batch.id}
                aria-label={`Tanda ${batch.name}`}
                className="bg-neutral-900 border border-white/5 rounded-2xl overflow-hidden"
              >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                  <h3 className="font-bold text-white">{batch.name}</h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="text-xs text-neutral-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Entrada
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Precio
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Vendidas
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          En proceso
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Disponibles
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          Recaudado
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-neutral-200">
                      {batch.ticketTypes.map((ticketType) => (
                        <tr key={ticketType.id}>
                          <td className="px-3 py-3 font-medium text-white">
                            {ticketType.name}
                          </td>
                          <td className={NUMBER_CELL}>
                            {formatCurrency(ticketType.price)}
                          </td>
                          <td className={NUMBER_CELL}>{ticketType.sold}</td>
                          <td className={NUMBER_CELL}>{ticketType.reserved}</td>
                          <td className={NUMBER_CELL}>
                            {ticketType.available}
                          </td>
                          <td className={`${NUMBER_CELL} text-emerald-400`}>
                            {formatCurrency(ticketType.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
