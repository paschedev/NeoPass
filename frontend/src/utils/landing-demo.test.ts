import { describe, expect, it } from 'vitest';
import { organizerDemo, promoterDemo } from './landing-demo';

const now = new Date('2026-10-11T15:00:00-03:00');

describe('Datos de ejemplo de la landing', () => {
  it('los eventos de ejemplo siempre son próximos, sea cual sea la fecha de hoy', () => {
    const events = [...organizerDemo(now).events, ...promoterDemo(now).events];

    for (const event of events) {
      expect(new Date(event.startDate).getTime()).toBeGreaterThan(
        now.getTime(),
      );
      expect(event.phase).toBe('NOT_STARTED');
    }
  });

  it('los números del organizador cierran: la deuda total suma lo que se le debe a cada RPP', () => {
    const { totals, events } = organizerDemo(now);
    const owedByEvent = events.map((event) =>
      event.promoters.reduce((sum, promoter) => sum + promoter.balance, 0),
    );

    expect(events.map((event) => event.owed)).toEqual(owedByEvent);
    expect(totals.owed).toBe(owedByEvent.reduce((sum, owed) => sum + owed, 0));
  });

  it('los números del RPP cierran: los totales suman lo de cada evento', () => {
    const { promoterTotals, events } = promoterDemo(now);
    const sum = (pick: (event: (typeof events)[number]) => number) =>
      events.reduce((total, event) => total + pick(event), 0);

    expect(promoterTotals).toEqual({
      owed: sum((event) => event.owed),
      totalEarned: sum((event) => event.promoter?.totalEarned ?? 0),
      totalPaid: sum((event) => event.promoter?.totalPaid ?? 0),
      ticketsSold: sum((event) => event.promoter?.ticketsSold ?? 0),
    });
  });
});
