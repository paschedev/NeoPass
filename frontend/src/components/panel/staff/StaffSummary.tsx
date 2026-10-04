import { formatCurrency } from '@/utils/format';
import { counted } from '@/utils/staff-overview';
import type { StaffOverview } from '../types';

const CARD = 'bg-neutral-900 border rounded-2xl p-5';

// Arriba de la pestaña: cuánto les debés a tus RPPs entre todos tus eventos,
// cuánto ya les pagaste y cuánta gente trabaja en lo que viene.
export default function StaffSummary({
  totals,
}: {
  totals: StaffOverview['totals'];
}) {
  const paidShare =
    totals.earned > 0 ? Math.round((totals.paid / totals.earned) * 100) : 0;

  return (
    <section
      aria-label="Resumen del staff"
      className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4"
    >
      <div className={`${CARD} col-span-2 lg:col-span-1 border-amber-500/20`}>
        <p className="text-sm text-neutral-400">Les debés a tus RPPs</p>
        <p className="font-outfit text-3xl font-bold text-amber-300 tabular-nums mt-1">
          {formatCurrency(totals.owed)}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          {totals.owed > 0
            ? `${counted(totals.promotersOwed, 'RPP', 'RPPs')} · ${counted(totals.eventsOwed, 'evento', 'eventos')}`
            : 'Estás al día'}
        </p>
      </div>
      <div className={`${CARD} border-white/5`}>
        <p className="text-sm text-neutral-400">Ya les pagaste</p>
        <p className="font-outfit text-2xl font-bold text-white tabular-nums mt-1">
          {formatCurrency(totals.paid)}
        </p>
        {totals.earned > 0 ? (
          <>
            <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full"
                style={{ width: `${paidShare}%` }}
              />
            </div>
            <p className="text-xs text-neutral-500 mt-2">
              {paidShare}% de {formatCurrency(totals.earned)} en comisiones
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-500 mt-1">
            Todavía no hay comisiones
          </p>
        )}
      </div>
      <div className={`${CARD} border-white/5`}>
        <p className="text-sm text-neutral-400">Staff activo</p>
        <p className="font-outfit text-2xl font-bold text-white tabular-nums mt-1">
          {counted(totals.activeStaff, 'persona', 'personas')}
        </p>
        <p className="text-xs text-neutral-500 mt-1">
          {totals.pendingInvitations > 0
            ? counted(
                totals.pendingInvitations,
                'invitación sin responder',
                'invitaciones sin responder',
              )
            : 'Sin invitaciones pendientes'}
        </p>
      </div>
    </section>
  );
}
