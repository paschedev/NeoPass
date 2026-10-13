// Un evento como lo ve el panel ADMIN (GET /admin/events).
export interface AdminEvent {
  id: string;
  title: string;
  status: string;
  startDate: string;
  endDate: string;
  deletedAt: string | null;
  // Si lo eliminó alguien que no es su organizador. null: no está eliminado.
  deletedByNeoPass: boolean | null;
  // Decimal de la base: llega como string ("8.5").
  neoPassFeePercentage: string;
  organizer: { name: string; email: string };
  // Solo compras pagadas. Recaudado: lo que pagaron por las entradas; el
  // cargo de servicio es lo que cobró NeoPass. En pesos.
  sales: {
    sold: number;
    capacity: number;
    revenue: number;
    serviceFee: number;
  };
}

export interface AdminEventsPage {
  items: AdminEvent[];
  total: number;
  page: number;
  limit: number;
}
