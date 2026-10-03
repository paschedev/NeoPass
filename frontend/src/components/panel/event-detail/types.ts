import type { BatchSaleStatus } from '@/utils/batches';

// Respuesta de GET /events/organizer/:id/sales.
export interface EventSales {
  event: {
    id: string;
    title: string;
    status: string;
    startDate: string;
    endDate: string;
    venueName: string | null;
    venueAddress: string | null;
  };
  totals: {
    revenue: number;
    sold: number;
    reserved: number;
    capacity: number;
    checkedIn: number;
    refundedOrders: number;
  };
  batches: {
    id: string;
    name: string;
    saleStatus: BatchSaleStatus;
    ticketTypes: {
      id: string;
      name: string;
      price: number;
      stock: number;
      sold: number;
      reserved: number;
      available: number;
      revenue: number;
    }[];
  }[];
}

// Respuesta de GET /events/organizer/:id/promoters.
export interface EventPromoter {
  id: string;
  status: string;
  name: string;
  email: string;
  commissionType: string | null;
  commissionValue: number | null;
  ticketsSold: number;
  salesAmount: number;
  totalEarned: number;
  totalPaid: number;
  balance: number;
  payments: { amount: number; note: string | null; createdAt: string }[];
}
