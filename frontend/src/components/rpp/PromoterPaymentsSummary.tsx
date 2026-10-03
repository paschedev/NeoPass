import { formatCurrency, formatDayMonthTime } from '@/utils/format';

// Lo que el organizador le pagó al RPP por un evento (los pagos pasan por fuera
// de NeoPass; el organizador los anota) y lo que todavía le debe.
export default function PromoterPaymentsSummary({
  totalPaid,
  balance,
  payments,
}: {
  totalPaid: number;
  balance: number;
  payments: { amount: number; note: string | null; createdAt: string }[];
}) {
  return (
    <section
      aria-label="Pagos"
      className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-10"
    >
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-neutral-400">Te pagaron</p>
          <div className="text-2xl font-outfit font-bold text-white">
            {formatCurrency(totalPaid)}
          </div>
        </div>
        <div>
          <p className="text-sm text-neutral-400">Te deben</p>
          <div className="text-2xl font-outfit font-bold text-emerald-400">
            {formatCurrency(balance)}
          </div>
        </div>
      </div>
      {payments.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Todavía no registraron pagos.
        </p>
      ) : (
        <ul
          aria-label="Pagos recibidos"
          className="divide-y divide-white/5 border-t border-white/5"
        >
          {payments.map((payment) => (
            <li
              key={payment.createdAt}
              className="flex justify-between gap-4 py-2 text-sm"
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
      )}
    </section>
  );
}
