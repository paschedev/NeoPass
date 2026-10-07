// Un evento como lo ve el panel ADMIN (GET /admin/events).
export interface AdminEvent {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  deletedAt: string | null;
  // Decimal de la base: llega como string ("8.5").
  neoPassFeePercentage: string;
  organizer: { name: string; email: string };
}

export interface AdminEventsPage {
  items: AdminEvent[];
  total: number;
  page: number;
  limit: number;
}
