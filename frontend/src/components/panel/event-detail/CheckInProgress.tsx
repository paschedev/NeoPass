'use client';

import { useEffect, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { apiFetch } from '@/utils/api';

type CheckIns = {
  checkedIn: number;
  total: number;
  byTicketType: {
    name: string;
    batch: string | null;
    checkedIn: number;
    total: number;
  }[];
};

const REFRESH_MS = 30_000;

const percent = (part: number, total: number) =>
  total === 0 ? 0 : Math.round((part / total) * 100);

function Bar({ value, label }: { value: number; label?: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-2 rounded-full bg-white/10 overflow-hidden"
    >
      <div
        className="h-full rounded-full bg-emerald-500 transition-[width]"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// Ingreso en puerta: entradas usadas sobre las que todavía pueden entrar. Con
// el evento en curso se actualiza solo.
export default function CheckInProgress({
  eventId,
  live,
}: {
  eventId: string;
  live: boolean;
}) {
  const [checkIns, setCheckIns] = useState<CheckIns | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    const load = () =>
      apiFetch(`/events/organizer/${eventId}/check-ins`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`GET check-ins ${res.status}`);
          return (await res.json()) as CheckIns;
        })
        .then((data) => {
          if (current) setCheckIns(data);
        })
        .catch((error: unknown) => {
          console.error(error);
          if (current) setFailed(true);
        });
    void load();
    const timer = live ? setInterval(() => void load(), REFRESH_MS) : null;
    return () => {
      current = false;
      if (timer) clearInterval(timer);
    };
  }, [eventId, live]);

  return (
    <section aria-label="Ingreso en puerta" className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <DoorOpen className="w-5 h-5 text-emerald-400" /> Ingreso en puerta
      </h2>
      {failed && !checkIns && (
        <p className="text-sm text-neutral-400">
          No pudimos cargar el ingreso.
        </p>
      )}
      {checkIns && (
        <div className="bg-neutral-900 border border-white/5 rounded-2xl p-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm text-neutral-400">Ingresaron</span>
              <span className="text-2xl font-bold text-white tabular-nums">
                {`${checkIns.checkedIn} de ${checkIns.total}`}
              </span>
            </div>
            <Bar
              label="Ingresaron"
              value={percent(checkIns.checkedIn, checkIns.total)}
            />
            {live && (
              <p className="text-xs text-neutral-500">
                Se actualiza solo cada 30 segundos.
              </p>
            )}
          </div>
          <ul className="space-y-3">
            {checkIns.byTicketType.map((type) => (
              <li key={`${type.batch}-${type.name}`} className="space-y-1">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-neutral-300">
                    {type.batch ? `${type.batch} · ${type.name}` : type.name}
                  </span>
                  <span className="text-neutral-400 tabular-nums">
                    {`${type.checkedIn} de ${type.total}`}
                  </span>
                </div>
                <Bar value={percent(type.checkedIn, type.total)} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
