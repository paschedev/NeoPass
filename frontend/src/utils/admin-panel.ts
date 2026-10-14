import { getEventPhase } from './event-edit';

export type AdminTab = 'eventos' | 'tickets';

// La pestaña y la búsqueda van en la URL: el botón de atrás vuelve a la
// anterior y un link lleva a una búsqueda ya hecha.
export function adminPanelUrl(tab: AdminTab, q: string): string {
  const params = new URLSearchParams({ tab });
  if (q) params.set('q', q);
  return `/panel/admin?${params}`;
}

// Espejo del backend: solo se reenvía una entrada que todavía deja entrar.
export function canResendTicket(
  ticket: {
    status: string;
    event: {
      status: string;
      startDate: string;
      endDate: string;
      deletedAt: string | null;
    };
  },
  now: Date,
): boolean {
  return (
    ticket.status === 'VALID' && getEventPhase(ticket.event, now) !== 'CLOSED'
  );
}
