'use client';

import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import StaffEventGroup from '@/components/panel/staff/StaffEventGroup';
import StaffSummary from '@/components/panel/staff/StaffSummary';
import { MyStaffEventsView } from '@/components/staff/MyStaffEvents';
import { organizerDemo, promoterDemo } from '@/utils/landing-demo';

type Tab = 'organizer' | 'promoter';

const TABS: [Tab, string][] = [
  ['organizer', 'Organizador'],
  ['promoter', 'RPP'],
];

const noop = () => {};
const subscribe = () => noop;

// Las fechas de ejemplo dependen de hoy: en el build (y al hidratar) no se
// arma la demo, así no difiere de lo que ve el navegador.
function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

// Vitrina de la landing: los paneles reales con datos inventados, sin
// llamadas a la API. El panel es inert: se mira, no se toca.
export default function LandingDemo() {
  const id = useId();
  const [tab, setTab] = useState<Tab>('organizer');
  const isClient = useIsClient();
  const demo = useMemo(() => {
    if (!isClient) return null;
    const now = new Date();
    return { organizer: organizerDemo(now), promoter: promoterDemo(now) };
  }, [isClient]);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Paneles de ejemplo"
        className="flex w-fit mx-auto bg-white/[0.02] border border-white/5 p-1 rounded-xl mb-8"
      >
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`${id}-${value}-tab`}
            aria-selected={tab === value}
            aria-controls={`${id}-${value}-panel`}
            onClick={() => setTab(value)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === value
                ? 'bg-white/10 text-white'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${id}-${tab}-panel`}
        aria-labelledby={`${id}-${tab}-tab`}
        inert
        className="relative max-w-5xl mx-auto max-h-[40rem] overflow-hidden"
      >
        {demo && (
          <div className="space-y-6">
            {tab === 'organizer' ? (
              <>
                <StaffSummary totals={demo.organizer.totals} />
                {demo.organizer.events.map((event) => (
                  <StaffEventGroup
                    key={event.id}
                    event={event}
                    onInvite={noop}
                    onPay={noop}
                    onEditFreeTickets={noop}
                  />
                ))}
              </>
            ) : (
              <MyStaffEventsView data={demo.promoter} onReload={noop} />
            )}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent" />
      </div>
    </div>
  );
}
