import type { EventDeletion } from '@/utils/event-deletion';

// Respuesta de GET /tickets/my-tickets.
export interface MyTicket {
  id: string;
  status: string;
  qrCode: string;
  ticketType: {
    name: string;
    event: {
      title: string;
      startDate: string;
      endDate: string;
      status: string;
      venueName: string | null;
      // Solo si el evento se eliminó: quién lo hizo y el contacto del organizador.
      deletion: EventDeletion | null;
    };
  };
}

// Anulada porque el pago se devolvió o tuvo un contracargo.
export const isVoidTicket = (status: string) =>
  status === 'REFUNDED' || status === 'CANCELLED';
