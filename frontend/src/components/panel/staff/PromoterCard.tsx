'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { formatCurrency, formatDayMonthTime } from '@/utils/format';
import { promoterFreeTicketsLabel } from '@/utils/promoter-free-tickets';
import {
  commissionLabel,
  otherEventsDebt,
  promoterDebtState,
} from '@/utils/staff-overview';
import type { StaffPromoter } from '../types';
import StaffIdentity, { InvitationChip } from './StaffIdentity';

const SMALL_BUTTON =
  'px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-neutral-500">{label}</dt>
      <dd className="text-sm font-semibold text-white tabular-nums truncate">
        {value}
      </dd>
    </div>
  );
}

// Lo que se le debe al RPP en este evento, o por qué no se le debe nada.
function Debt({ promoter }: { promoter: StaffPromoter }) {
  const state = promoterDebtState(promoter);
  if (state === 'owed') {
    return (
      <div>
        <p className="text-xs text-neutral-500">Le debés</p>
        <p className="font-outfit text-xl font-bold text-amber-300 tabular-nums">
          {formatCurrency(promoter.balance)}
        </p>
      </div>
    );
  }
  if (state === 'settled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/15 text-emerald-300">
        <Check className="w-3.5 h-3.5" /> Al día
      </span>
    );
  }
  return (
    <p className="text-xs text-neutral-400">
      {state === 'overpaid'
        ? `Le pagaste ${formatCurrency(-promoter.balance)} de más`
        : 'Sin ventas todavía'}
    </p>
  );
}

// "Cambiar" o "Dar QR free": solo para el dueño, con el evento sin terminar.
function FreeTicketsButton({
  promoter,
  onEdit,
}: {
  promoter: StaffPromoter;
  onEdit: (promoter: StaffPromoter) => void;
}) {
  const has = promoter.freeTickets !== null;
  return (
    <button
      type="button"
      aria-label={
        has
          ? `Cambiar QR free de ${promoter.name}`
          : `Dar QR free a ${promoter.name}`
      }
      onClick={() => onEdit(promoter)}
      className={`${SMALL_BUTTON} text-indigo-300 hover:bg-indigo-500/10`}
    >
      {has ? 'Cambiar' : 'Dar QR free'}
    </button>
  );
}

// Tarjeta de un RPP dentro de un evento: lo que vendió, ganó y cobró, lo que
// se le debe y sus QR free. Los pagos pasan por fuera de NeoPass; acá se
// anotan. Sin onEditFreeTickets (evento terminado) los QR free solo se ven.
export default function PromoterCard({
  promoter,
  onPay,
  onEditFreeTickets,
}: {
  promoter: StaffPromoter;
  onPay: (promoter: StaffPromoter) => void;
  onEditFreeTickets?: (promoter: StaffPromoter) => void;
}) {
  const [showPayments, setShowPayments] = useState(false);
  const commission = commissionLabel(
    promoter.commissionType,
    promoter.commissionValue,
  );
  const { freeTickets } = promoter;

  if (promoter.status !== 'ACCEPTED') {
    const pending = promoter.status === 'PENDING';
    return (
      <article
        aria-label={promoter.name}
        className="bg-white/[0.02] border border-dashed border-white/10 rounded-2xl p-4"
      >
        <StaffIdentity
          name={promoter.name}
          email={promoter.email}
          aside={<InvitationChip status={promoter.status} />}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
          <p className="text-xs text-neutral-500">
            {pending
              ? [
                  'Todavía no aceptó',
                  commission,
                  freeTickets && `hasta ${freeTickets.limit} QR free`,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : 'Rechazó la invitación'}
          </p>
          {pending && onEditFreeTickets && (
            <FreeTicketsButton promoter={promoter} onEdit={onEditFreeTickets} />
          )}
        </div>
      </article>
    );
  }

  const elsewhere = otherEventsDebt(promoter);
  const { payments } = promoter;

  return (
    <article
      aria-label={promoter.name}
      className="bg-white/5 border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-colors"
    >
      <StaffIdentity
        name={promoter.name}
        email={promoter.email}
        aside={
          commission && (
            <span className="shrink-0 px-2 py-1 rounded-md text-[11px] font-medium bg-indigo-500/15 text-indigo-300">
              {commission}
            </span>
          )
        }
      />
      <dl className="grid grid-cols-3 gap-2 my-4 p-3 bg-black/40 rounded-xl">
        <Stat label="Vendidas" value={String(promoter.ticketsSold)} />
        <Stat label="Ganó" value={formatCurrency(promoter.totalEarned)} />
        <Stat label="Pagado" value={formatCurrency(promoter.totalPaid)} />
      </dl>
      {(freeTickets || onEditFreeTickets) && (
        <div className="flex items-center justify-between gap-3 -mt-2 mb-4">
          <p
            className={`text-xs ${freeTickets ? 'text-neutral-300' : 'text-neutral-500'}`}
          >
            {freeTickets
              ? promoterFreeTicketsLabel(freeTickets)
              : 'Sin QR free'}
          </p>
          {onEditFreeTickets && (
            <FreeTicketsButton promoter={promoter} onEdit={onEditFreeTickets} />
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Debt promoter={promoter} />
        <div className="flex gap-2">
          {payments.length > 0 && (
            <button
              type="button"
              aria-label={`Ver pagos a ${promoter.name} (${payments.length})`}
              aria-expanded={showPayments}
              onClick={() => setShowPayments((open) => !open)}
              className={`${SMALL_BUTTON} text-neutral-300 hover:bg-white/10`}
            >
              Pagos ({payments.length})
            </button>
          )}
          {promoter.balance > 0 && (
            <button
              type="button"
              aria-label={`Registrar pago a ${promoter.name}`}
              onClick={() => onPay(promoter)}
              className={`${SMALL_BUTTON} border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10`}
            >
              Registrar pago
            </button>
          )}
        </div>
      </div>
      {elsewhere && <p className="text-xs text-neutral-500 mt-2">{elsewhere}</p>}
      {showPayments && (
        <ul
          aria-label={`Pagos a ${promoter.name}`}
          className="mt-3 bg-black/40 rounded-xl divide-y divide-white/5"
        >
          {payments.map((payment) => (
            <li
              key={payment.createdAt}
              className="flex justify-between gap-4 px-3 py-2 text-xs"
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
    </article>
  );
}
