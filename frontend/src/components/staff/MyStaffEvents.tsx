'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { apiFetch } from '@/utils/api';
import { formatCurrency } from '@/utils/format';
import { splitSettledClosed } from '@/utils/staff-overview';
import MyStaffEventCard from './MyStaffEventCard';
import StaffInvitations from './StaffInvitations';
import type { MyStaff } from './types';

function Tile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-neutral-900 border border-white/5 rounded-2xl p-4">
      <p className="text-sm text-neutral-400">{label}</p>
      <p
        className={`font-outfit text-2xl font-bold tabular-nums mt-1 ${accent ? 'text-emerald-400' : 'text-white'}`}
      >
        {value}
      </p>
    </div>
  );
}

// Página Staff: los eventos donde la persona trabaja como RPP, scanner o
// co-organizador, sus números como RPP y las invitaciones que tiene que responder.
export default function MyStaffEvents() {
  const [data, setData] = useState<MyStaff | null>(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [showSettled, setShowSettled] = useState(false);

  useEffect(() => {
    let current = true;
    apiFetch('/events/staff/me')
      .then(async (res) => {
        if (!res.ok) throw new Error(`GET staff/me ${res.status}`);
        return (await res.json()) as MyStaff;
      })
      .then((mine) => {
        if (current) setData(mine);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [version]);

  const reload = () => {
    setFailed(false);
    setVersion((count) => count + 1);
  };

  if (failed) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-3xl p-10 text-center">
        <p className="text-neutral-300 mb-4">No pudimos cargar tus eventos.</p>
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
  if (!data) {
    return (
      <div className="text-center py-12 text-neutral-500">
        Cargando tus eventos...
      </div>
    );
  }

  const { active, settled } = splitSettledClosed(data.events);
  const totals = data.promoterTotals;

  return (
    <div className="space-y-6">
      {data.invitations.length > 0 && (
        <StaffInvitations
          invitations={data.invitations}
          onAnswered={reload}
        />
      )}

      {totals && (
        <section
          aria-label="Tus números como RPP"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <Tile label="Te deben" value={formatCurrency(totals.owed)} accent />
          <Tile label="Te pagaron" value={formatCurrency(totals.totalPaid)} />
          <Tile label="Ganaste" value={formatCurrency(totals.totalEarned)} />
          <Tile label="Entradas vendidas" value={String(totals.ticketsSold)} />
        </section>
      )}

      {data.events.length === 0 && data.invitations.length === 0 && (
        <div className="text-center py-12 px-6 bg-white/[0.02] rounded-3xl border border-white/5 border-dashed">
          <CalendarDays className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-neutral-400 mb-2">
            Todavía no trabajás en ningún evento
          </h3>
          <p className="text-sm text-neutral-500">
            Cuando un organizador te invite como RPP o scanner y aceptes, el
            evento va a aparecer acá.
          </p>
        </div>
      )}

      {active.map((event) => (
        <MyStaffEventCard key={event.id} event={event} />
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
            Terminados · {settled.length}
          </button>
          {showSettled &&
            settled.map((event) => (
              <MyStaffEventCard key={event.id} event={event} />
            ))}
        </>
      )}
    </div>
  );
}
