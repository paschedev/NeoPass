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
  // Solo compras pagadas. Recaudado: lo que pagaron por las entradas;
  // marketplaceFee: lo que se quedó NeoPass del cargo. En pesos.
  sales: {
    sold: number;
    capacity: number;
    revenue: number;
    marketplaceFee: number;
  };
}

// Una página de cualquiera de las listas del panel ADMIN.
export interface AdminPage<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

interface AdminPerson {
  name: string;
  email: string;
}

// Una entrada como la ve el panel ADMIN (GET /admin/tickets). Nunca trae el
// QR: es lo que deja entrar.
export interface AdminTicket {
  id: string;
  // El código impreso en la entrada que le llega a quien la tiene.
  code: string;
  status: 'VALID' | 'USED' | 'CANCELLED' | 'REFUNDED';
  usedAt: string | null;
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    deletedAt: string | null;
  };
  ticketType: { name: string; batchName: string | null };
  // La cuenta dueña o, en un QR free, el correo al que se mandó (sin nombre
  // si el organizador no lo puso).
  owner: { name: string | null; email: string } | null;
  // Solo si la compró otra persona y se la transfirió.
  buyer: AdminPerson | null;
  origin:
    | {
        type: 'PURCHASE';
        purchasedAt: string;
        // Lo que pagó por toda la compra, en pesos.
        total: number;
        promoterName: string | null;
      }
    | { type: 'FREE'; sentBy: string; validUntil: string | null }
    | null;
}
