'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, UserPlus, Users } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { splitSettledClosed } from '@/utils/staff-overview';
import PromoterPaymentModal, {
  type PaymentTarget,
} from './event-detail/PromoterPaymentModal';
import PromoterFreeTicketsModal, {
  type FreeTicketsTarget,
} from './staff/PromoterFreeTicketsModal';
import StaffEventGroup, { type InvitePreset } from './staff/StaffEventGroup';
import StaffSummary from './staff/StaffSummary';
import type { StaffOverview } from './types';

type Filter = 'all' | 'owed';

const EMPTY_BOX =
  'text-center py-12 px-6 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed';

// Pestaña "Mi staff" del panel del organizador: el staff de cada evento y
// lo que se les debe a los RPPs (en total, por evento y a cada uno).
export default function StaffTab({
  refreshKey,
  onInvite,
}: {
  // Cambia cuando se envían invitaciones, para recargar la lista.
  refreshKey: number;
  onInvite: (preset?: InvitePreset) => void;
}) {
  const [overview, setOverview] = useState<StaffOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [showSettled, setShowSettled] = useState(false);
  const [paying, setPaying] = useState<PaymentTarget | null>(null);
  const [editingFreeTickets, setEditingFreeTickets] =
    useState<FreeTicketsTarget | null>(null);

  useEffect(() => {
    let current = true;
    apiFetch('/events/organizer/staff/overview')
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET staff overview ${res.status}`);
        return (await res.json()) as StaffOverview;
      })
      .then((data) => {
        if (current) setOverview(data);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [refreshKey, version]);

  const reload = () => {
    setFailed(false);
    setVersion((count) => count + 1);
  };

  const renderContent = () => {
    if (failed) {
      return (
        <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-10 text-center">
          <p className="text-neutral-300 mb-4">No pudimos cargar tu staff.</p>
          <button
            type="button"
            onClick={reload}
            className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-xl transition-colors font-medium"
          >
            Reintentar
          </button>
        </div>
      );
    }
    if (!overview) {
      return (
        <div className="text-center py-12 text-neutral-500">
          Cargando staff...
        </div>
      );
    }
    if (overview.events.length === 0) {
      return (
        <div className={EMPTY_BOX}>
          <Users className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-neutral-400 mb-2">
            No tenés staff asignado
          </h3>
          <p className="text-sm text-neutral-500">
            Cuando tengas un evento próximo, sumá scanners y promotores con
            &quot;Enviar invitación&quot;.
          </p>
        </div>
      );
    }

    const visible =
      filter === 'owed'
        ? overview.events.filter((event) => event.owed > 0)
        : overview.events;
    const { active, settled } = splitSettledClosed(visible);
    const filters: [Filter, string][] = [
      ['all', `Todos · ${overview.events.length}`],
      ['owed', `Con deuda · ${overview.totals.eventsOwed}`],
    ];

    return (
      <>
        <StaffSummary totals={overview.totals} />

        <div
          role="group"
          aria-label="Filtrar eventos"
          className="flex w-fit bg-white/[0.02] border border-white/5 p-1 rounded-xl"
        >
          {filters.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === value
                  ? 'bg-white/10 text-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {active.length === 0 && filter === 'owed' && (
          <p className={`${EMPTY_BOX} text-sm text-neutral-400`}>
            No les debés nada a tus RPPs.
          </p>
        )}

        {active.map((event) => (
          <StaffEventGroup
            key={event.id}
            event={event}
            onInvite={onInvite}
            onPay={setPaying}
            onEditFreeTickets={setEditingFreeTickets}
          />
        ))}

        {settled.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showSettled}
              onClick={() => setShowSettled((open) => !open)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.03] border border-white/5 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              {showSettled ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Finalizados al día · {settled.length}
            </button>
            {showSettled &&
              settled.map((event) => (
                <StaffEventGroup
                  key={event.id}
                  event={event}
                  onInvite={onInvite}
                  onPay={setPaying}
                  onEditFreeTickets={setEditingFreeTickets}
                />
              ))}
          </>
        )}
      </>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-outfit text-2xl font-bold">
            Mi staff
          </h2>
          <p className="text-sm text-neutral-400">
            Tu equipo en cada evento y lo que les debés a tus RPPs.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onInvite()}
          className="self-start sm:self-auto bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2"
        >
          <UserPlus className="w-4 h-4" /> Enviar invitación
        </button>
      </div>

      {renderContent()}

      <PromoterPaymentModal
        target={paying}
        onClose={() => setPaying(null)}
        onPaid={() => {
          setPaying(null);
          reload();
        }}
      />
      <PromoterFreeTicketsModal
        target={editingFreeTickets}
        onClose={() => setEditingFreeTickets(null)}
        onSaved={() => {
          setEditingFreeTickets(null);
          reload();
        }}
      />
    </motion.div>
  );
}
