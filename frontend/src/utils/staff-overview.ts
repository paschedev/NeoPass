import type { EventPhase } from './event-edit';
import { formatCurrency } from './format';

type Person = { status: string };

type StaffGroup = {
  phase: EventPhase;
  status: string;
  owed: number;
  promoters: Person[];
  scanners: Person[];
  managers: Person[];
};

export function eventPhaseLabel({
  phase,
  status,
}: Pick<StaffGroup, 'phase' | 'status'>): string {
  if (phase === 'IN_PROGRESS') return 'En curso';
  if (phase === 'NOT_STARTED') return 'Próximo';
  return status === 'CANCELLED' ? 'Cancelado' : 'Finalizado';
}

// Los eventos terminados que no deben nada van plegados al final de la lista.
export function splitSettledClosed<T extends Pick<StaffGroup, 'phase' | 'owed'>>(
  events: T[],
) {
  const isSettled = (event: T) => event.phase === 'CLOSED' && event.owed === 0;
  return {
    active: events.filter((event) => !isSettled(event)),
    settled: events.filter(isSettled),
  };
}

// Nadie puede controlar en la puerta salvo el organizador: no hay scanner ni
// co-organizador que haya aceptado.
export function lacksDoorStaff(
  event: Pick<StaffGroup, 'phase' | 'scanners' | 'managers'>,
): boolean {
  return (
    event.phase !== 'CLOSED' &&
    ![...event.scanners, ...event.managers].some(
      (person) => person.status === 'ACCEPTED',
    )
  );
}

// "1 RPP", "3 RPPs".
export const counted = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

export function staffCounts(
  event: Pick<StaffGroup, 'promoters' | 'scanners' | 'managers'>,
): string {
  const { promoters, scanners, managers } = event;
  const pending = [...promoters, ...scanners, ...managers].filter(
    (person) => person.status === 'PENDING',
  ).length;
  const parts = [
    promoters.length && counted(promoters.length, 'RPP', 'RPPs'),
    scanners.length && counted(scanners.length, 'scanner', 'scanners'),
    managers.length && counted(managers.length, 'co-organizador', 'co-organizadores'),
    pending && counted(pending, 'pendiente', 'pendientes'),
  ].filter(Boolean);
  return parts.join(' · ') || 'Sin staff todavía';
}

export function commissionLabel(
  type: string | null,
  value: number | null,
): string | null {
  if (value === null) return null;
  return type === 'PERCENTAGE'
    ? `${value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}% por entrada`
    : `${formatCurrency(value)} por entrada`;
}

export type PromoterDebtState = 'owed' | 'overpaid' | 'settled' | 'no-sales';

// Un saldo negativo es un pago de más: una devolución bajó lo que había ganado.
export function promoterDebtState({
  balance,
  totalEarned,
}: {
  balance: number;
  totalEarned: number;
}): PromoterDebtState {
  if (balance > 0) return 'owed';
  if (balance < 0) return 'overpaid';
  return totalEarned > 0 ? 'settled' : 'no-sales';
}

// La línea extra de la tarjeta de un RPP cuando también se le debe en otros
// eventos del organizador.
export function otherEventsDebt({
  balance,
  owedAcrossEvents: { amount, events },
}: {
  balance: number;
  owedAcrossEvents: { amount: number; events: number };
}): string | null {
  if (balance > 0) {
    return events > 1
      ? `En total le debés ${formatCurrency(amount)} en ${events} eventos`
      : null;
  }
  return events > 0 ? `En otros eventos le debés ${formatCurrency(amount)}` : null;
}
