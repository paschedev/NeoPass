'use client';

import {
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import StaffEventGroup from '@/components/panel/staff/StaffEventGroup';
import StaffSummary from '@/components/panel/staff/StaffSummary';
import { MyStaffEventsView } from '@/components/staff/MyStaffEvents';
import MyStaffEventCard from '@/components/staff/MyStaffEventCard';
import { organizerDemo, promoterDemo } from '@/utils/landing-demo';

type Tab = 'organizer' | 'promoter';

const TABS: [Tab, string][] = [
  ['organizer', 'Organizador'],
  ['promoter', 'RRPP'],
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

// Lo que sigue al primer evento: cortado y desvanecido, para que se note que
// hay más sin tapar nada útil. No suma a su alto (contain: size) y crece
// hasta igualar a la otra pestaña, así cambiar de pestaña no mueve la página.
function Teaser({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="flex-1 min-h-36 overflow-hidden [contain:size] [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_9rem),transparent)]"
    >
      <div className="space-y-6">{children}</div>
    </div>
  );
}

// Vitrina de la landing: los paneles reales con datos inventados, sin
// llamadas a la API. El panel es inert: se mira, no se toca.
export default function LandingDemo() {
  const id = useId();
  const [tab, setTab] = useState<Tab>('organizer');
  const isClient = useIsClient();
  const panels = useMemo((): Record<Tab, ReactNode> | null => {
    if (!isClient) return null;
    const now = new Date();
    const organizer = organizerDemo(now);
    const promoter = promoterDemo(now);
    const [firstGroup, ...nextGroups] = organizer.events;
    const [firstEvent, ...nextEvents] = promoter.events;
    return {
      organizer: (
        <>
          <StaffSummary totals={organizer.totals} />
          <StaffEventGroup
            event={firstGroup}
            onInvite={noop}
            onPay={noop}
            onEditFreeTickets={noop}
          />
          <Teaser>
            {nextGroups.map((event) => (
              <StaffEventGroup
                key={event.id}
                event={event}
                onInvite={noop}
                onPay={noop}
                onEditFreeTickets={noop}
              />
            ))}
          </Teaser>
        </>
      ),
      promoter: (
        <>
          <MyStaffEventsView
            data={{ ...promoter, events: [firstEvent] }}
            onReload={noop}
          />
          <Teaser>
            {nextEvents.map((event) => (
              <MyStaffEventCard key={event.id} event={event} />
            ))}
          </Teaser>
        </>
      ),
    };
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

      {/* Las dos pestañas ocupan la misma celda: mide lo que la más alta. */}
      <div className="grid max-w-5xl mx-auto">
        {TABS.map(([value]) => {
          const active = tab === value;
          return (
            <div
              key={value}
              role="tabpanel"
              id={`${id}-${value}-panel`}
              aria-labelledby={`${id}-${value}-tab`}
              aria-hidden={active ? undefined : true}
              inert
              className={`[grid-area:1/1] flex flex-col gap-6 ${
                active ? '' : 'invisible'
              }`}
            >
              {panels?.[value]}
            </div>
          );
        })}
      </div>
    </div>
  );
}
