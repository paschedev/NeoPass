import type { EventDeletion } from '@/utils/event-deletion';

// Respuesta de GET /tickets/my-tickets.
export interface MyTicket {
  id: string;
  status: string;
  qrCode: string;
  // Solo en un QR free: llegó de regalo al correo de la cuenta y, si tiene,
  // hasta cuándo deja entrar.
  freeTicket: { validUntil: string | null } | null;
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

// Anulada: el pago se devolvió o tuvo un contracargo, o el organizador anuló
// el QR free.
export const isVoidTicket = (status: string) =>
  status === 'REFUNDED' || status === 'CANCELLED';
