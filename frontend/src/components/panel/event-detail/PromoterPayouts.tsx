'use client';

import { Fragment, useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatCurrency, formatDayMonthTime } from '@/utils/format';
import PromoterPaymentModal from './PromoterPaymentModal';
import type { EventPromoter } from './types';

const NUMBER_CELL = 'px-3 py-3 text-right tabular-nums whitespace-nowrap';
const HEADER_CELL = 'px-3 py-2 text-right font-medium';

// RPPs del evento: lo vendido, la comisión ganada, lo pagado y el saldo. Los
// pagos pasan por fuera de NeoPass; acá el organizador los anota.
export default function PromoterPayouts({ eventId }: { eventId: string }) {
  const [promoters, setPromoters] = useState<EventPromoter[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [paying, setPaying] = useState<EventPromoter | null>(null);
  const [historyOf, setHistoryOf] = useState<string | null>(null);
  const path = `/events/organizer/${eventId}/promoters`;

  useEffect(() => {
    let current = true;
    apiFetch(path)
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET promoters ${res.status}`);
        return (await res.json()) as EventPromoter[];
      })
      .then((list) => {
        if (current) setPromoters(list);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [path, version]);

  return (
    <section aria-label="RPPs" className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Users className="w-5 h-5 text-purple-400" /> RPPs
      </h2>

      {failed && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar los RPPs del evento.
        </p>
      )}
      {!failed && promoters === null && (
        <p className="text-sm text-neutral-400">Cargando RPPs...</p>
      )}
      {promoters?.length === 0 && (
        <p className="text-sm text-neutral-400">Este evento no tiene RPPs.</p>
      )}

      {promoters && promoters.length > 0 && (
        <div className="relative bg-neutral-900 border border-white/5 rounded-2xl overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">RPP</th>
                <th className={HEADER_CELL}>Vendidas</th>
                <th className={HEADER_CELL}>Ventas</th>
                <th className={HEADER_CELL}>Ganado</th>
                <th className={HEADER_CELL}>Pagado</th>
                <th className={HEADER_CELL}>Saldo</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-neutral-200">
              {promoters.map((promoter) => (
                <Fragment key={promoter.id}>
                  <tr>
                    <td className="px-3 py-3">
                      <div className="font-medium text-white">
                        {promoter.name}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {promoter.email}
                      </div>
                    </td>
                    <td className={NUMBER_CELL}>{promoter.ticketsSold}</td>
                    <td className={NUMBER_CELL}>
                      {formatCurrency(promoter.salesAmount)}
                    </td>
                    <td className={NUMBER_CELL}>
                      {formatCurrency(promoter.totalEarned)}
                    </td>
                    <td className={NUMBER_CELL}>
                      {formatCurrency(promoter.totalPaid)}
                    </td>
                    <td className={`${NUMBER_CELL} font-semibold text-white`}>
                      {formatCurrency(promoter.balance)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {promoter.payments.length > 0 && (
                          <button
                            type="button"
                            aria-label={`Ver pagos a ${promoter.name} (${promoter.payments.length})`}
                            aria-expanded={historyOf === promoter.id}
                            onClick={() =>
                              setHistoryOf((open) =>
                                open === promoter.id ? null : promoter.id,
                              )
                            }
                            className="px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 hover:bg-white/10 transition-colors whitespace-nowrap"
                          >
                            Pagos ({promoter.payments.length})
                          </button>
                        )}
                        {promoter.balance > 0 && (
                          <button
                            type="button"
                            aria-label={`Registrar pago a ${promoter.name}`}
                            onClick={() => setPaying(promoter)}
                            className="px-3 py-2 rounded-lg text-xs font-medium border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 transition-colors whitespace-nowrap"
                          >
                            Registrar pago
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {historyOf === promoter.id && (
                    <tr>
                      <td colSpan={7} className="px-3 pb-4">
                        <ul
                          aria-label={`Pagos a ${promoter.name}`}
                          className="bg-black/40 rounded-xl divide-y divide-white/5"
                        >
                          {promoter.payments.map((payment) => (
                            <li
                              key={payment.createdAt}
                              className="flex justify-between gap-4 px-4 py-2 text-xs"
                            >
                              <span className="text-neutral-400">
                                {formatDayMonthTime(payment.createdAt)}
                                {payment.note && ` · ${payment.note}`}
                              </span>
                              <span className="font-semibold text-white tabular-nums">
                                {formatCurrency(payment.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PromoterPaymentModal
        target={
          paying && {
            eventId,
            staffId: paying.id,
            name: paying.name,
            balance: paying.balance,
          }
        }
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          setVersion((count) => count + 1);
        }}
      />
    </section>
  );
}
