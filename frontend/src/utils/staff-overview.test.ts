import { describe, expect, it } from 'vitest';
import {
  commissionLabel,
  eventPhaseLabel,
  lacksDoorStaff,
  otherEventsDebt,
  promoterDebtState,
  splitSettledClosed,
  staffCounts,
} from './staff-overview';

const person = (status = 'ACCEPTED') => ({ status });

const group = (overrides = {}) => ({
  phase: 'NOT_STARTED' as const,
  status: 'PUBLISHED',
  owed: 0,
  promoters: [] as { status: string }[],
  scanners: [] as { status: string }[],
  managers: [] as { status: string }[],
  ...overrides,
});

describe('eventPhaseLabel', () => {
  it('nombra la etapa del evento', () => {
    expect(eventPhaseLabel(group({ phase: 'IN_PROGRESS' }))).toBe('En curso');
    expect(eventPhaseLabel(group({ phase: 'NOT_STARTED' }))).toBe('Próximo');
    expect(eventPhaseLabel(group({ phase: 'CLOSED' }))).toBe('Finalizado');
    expect(
      eventPhaseLabel(group({ phase: 'CLOSED', status: 'CANCELLED' })),
    ).toBe('Cancelado');
  });
});

describe('splitSettledClosed', () => {
  it('aparta los eventos terminados que no deben nada y deja el resto en orden', () => {
    const events = [
      group({ phase: 'IN_PROGRESS', owed: 0 }),
      group({ phase: 'CLOSED', owed: 50 }),
      group({ phase: 'CLOSED', owed: 0 }),
      group({ phase: 'NOT_STARTED', owed: 0 }),
    ];

    const { active, settled } = splitSettledClosed(events);

    expect(active).toEqual([events[0], events[1], events[3]]);
    expect(settled).toEqual([events[2]]);
  });
});

describe('lacksDoorStaff', () => {
  it('avisa si un evento que no terminó no tiene scanner ni co-organizador aceptado', () => {
    expect(lacksDoorStaff(group())).toBe(true);
    expect(
      lacksDoorStaff(
        group({ scanners: [person('PENDING'), person('REJECTED')] }),
      ),
    ).toBe(true);
    expect(lacksDoorStaff(group({ promoters: [person()] }))).toBe(true);
  });

  it('no avisa si hay un scanner o un co-organizador aceptado, ni en eventos terminados', () => {
    expect(lacksDoorStaff(group({ scanners: [person()] }))).toBe(false);
    expect(lacksDoorStaff(group({ managers: [person()] }))).toBe(false);
    expect(lacksDoorStaff(group({ phase: 'CLOSED' }))).toBe(false);
  });
});

describe('staffCounts', () => {
  it('cuenta cada rol y las invitaciones pendientes', () => {
    expect(
      staffCounts(
        group({
          promoters: [person(), person('PENDING')],
          scanners: [person()],
          managers: [person(), person()],
        }),
      ),
    ).toBe('2 RPPs · 1 scanner · 2 co-organizadores · 1 pendiente');
    expect(
      staffCounts(
        group({ promoters: [person()], scanners: [person(), person()] }),
      ),
    ).toBe('1 RPP · 2 scanners');
  });

  it('un evento sin staff lo dice', () => {
    expect(staffCounts(group())).toBe('Sin staff todavía');
  });
});

describe('commissionLabel', () => {
  it('muestra la comisión pactada por entrada', () => {
    expect(commissionLabel('PERCENTAGE', 12.5)).toBe('12,5% por entrada');
    expect(commissionLabel('FIXED', 1500)).toBe('$1.500 por entrada');
    expect(commissionLabel(null, null)).toBeNull();
  });
});

describe('promoterDebtState', () => {
  it('distingue deuda, pago de más, al día y sin ventas', () => {
    expect(promoterDebtState({ balance: 10, totalEarned: 10 })).toBe('owed');
    expect(promoterDebtState({ balance: -5, totalEarned: 10 })).toBe(
      'overpaid',
    );
    expect(promoterDebtState({ balance: 0, totalEarned: 10 })).toBe('settled');
    expect(promoterDebtState({ balance: 0, totalEarned: 0 })).toBe('no-sales');
  });
});

describe('otherEventsDebt', () => {
  it('si se le debe en este y en otros eventos, muestra el total', () => {
    expect(
      otherEventsDebt({
        balance: 100,
        owedAcrossEvents: { amount: 150.5, events: 2 },
      }),
    ).toBe('En total le debés $150,50 en 2 eventos');
  });

  it('si está al día en este evento pero se le debe en otros, lo aclara', () => {
    expect(
      otherEventsDebt({
        balance: 0,
        owedAcrossEvents: { amount: 3000, events: 1 },
      }),
    ).toBe('En otros eventos le debés $3.000');
  });

  it('si solo se le debe en este evento, no agrega nada', () => {
    expect(
      otherEventsDebt({
        balance: 100,
        owedAcrossEvents: { amount: 100, events: 1 },
      }),
    ).toBeNull();
    expect(
      otherEventsDebt({
        balance: 0,
        owedAcrossEvents: { amount: 0, events: 0 },
      }),
    ).toBeNull();
  });
});
