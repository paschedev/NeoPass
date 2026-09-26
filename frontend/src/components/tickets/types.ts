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

export const formatEventDate = (startDate: string) =>
  new Date(startDate).toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
