// Respuesta de GET /tickets/my-tickets.
export interface MyTicket {
  id: string;
  status: string;
  qrCode: string;
  ticketType: {
    name: string;
    event: { title: string; startDate: string; venueName: string | null };
  };
}

// Anulada porque el pago se devolvió o tuvo un contracargo.
export const isVoidTicket = (status: string) =>
  status === 'REFUNDED' || status === 'CANCELLED';

export const formatEventDate = (startDate: string) =>
  new Date(startDate).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
