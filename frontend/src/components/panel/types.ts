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
  venueName: string | null;
  ticketTypes: { sold: number; price: number | string }[];
}

// Respuesta de GET /events/organizer/staff.
export interface StaffMember {
  id: string;
  role: string;
  status: string;
  commissionType: string | null;
  commissionValue: number | string | null;
  user: { name: string; email: string };
  event: { title: string };
}
