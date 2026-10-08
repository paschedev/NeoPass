import type { EventPhase } from '@/utils/event-edit';
import type { PromoterFreeTickets } from '@/utils/promoter-free-tickets';
import type { RevenuePoint } from '@/utils/sales-chart';

export interface Transaction {
  name: string;
  event: string;
  amount: number | string;
  time: string;
  status: string;
}

// Respuesta de GET /events/organizer/stats.
export interface DashboardStats {
  totalEvents: number;
  totalTicketsSold: number;
  totalRevenue: number;
  activeEvents: number;
  chartData: RevenuePoint[];
  recentTransactions: Transaction[];
}

// Respuesta de GET /events/organizer/me.
export interface OrganizerEvent {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  // Eliminado por su organizador o dado de baja por NeoPass: queda en el
  // historial con sus ventas, de solo lectura.
  deletedAt: string | null;
  venueName: string | null;
  ticketTypes: { sold: number; price: number | string }[];
  // Lo cobrado por las entradas (órdenes pagadas), no vendidas × precio actual.
  revenue: number;
}

// Respuesta de GET /events/organizer/staff/overview.
export interface StaffPerson {
  id: string;
  status: string;
  name: string;
  email: string;
}

export interface StaffPromoter extends StaffPerson {
  commissionType: string | null;
  commissionValue: number | null;
  ticketsSold: number;
  totalEarned: number;
  totalPaid: number;
  // Negativo si se le pagó de más (una devolución bajó lo que ganó).
  balance: number;
  // Lo que se le debe sumando todos los eventos del organizador.
  owedAcrossEvents: { amount: number; events: number };
  payments: { amount: number; note: string | null; createdAt: string }[];
  // Null si el dueño no le dio QR free en este evento.
  freeTickets: PromoterFreeTickets | null;
}

export interface StaffEventGroup {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  deletedAt: string | null;
  phase: EventPhase;
  owed: number;
  promoters: StaffPromoter[];
  scanners: StaffPerson[];
  managers: StaffPerson[];
}

export interface StaffOverview {
  totals: {
    owed: number;
    paid: number;
    earned: number;
    promotersOwed: number;
    eventsOwed: number;
    // Personas e invitaciones de eventos que no terminaron.
    activeStaff: number;
    pendingInvitations: number;
  };
  events: StaffEventGroup[];
}
