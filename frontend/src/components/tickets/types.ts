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
    };
  };
}

// Anulada porque el pago se devolvió o tuvo un contracargo.
export const isVoidTicket = (status: string) =>
  status === 'REFUNDED' || status === 'CANCELLED';
