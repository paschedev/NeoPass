import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventDetailPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'event-1' }) }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

describe('Detalle del evento', () => {
  afterEach(() => vi.clearAllMocks());

  it('pide las ventas, el ingreso, los RPPs, los QR free y los asistentes del evento y los muestra', async () => {
    const sales = Response.json({
      event: {
        id: 'event-1',
        title: 'Fiesta de primavera',
        status: 'PUBLISHED',
        startDate: '2030-10-10T01:00:00.000Z',
        endDate: '2030-10-10T08:00:00.000Z',
        venueName: 'Club Central',
        venueAddress: 'Av. Corrientes 1234',
      },
      totals: {
        revenue: 0,
        sold: 0,
        reserved: 0,
        capacity: 100,
        checkedIn: 0,
        refundedOrders: 0,
      },
      batches: [],
    });
    vi.mocked(apiFetch).mockImplementation(async (path) => {
      if (path.endsWith('/sales')) return sales;
      if (path.endsWith('/check-ins')) {
        return Response.json({ checkedIn: 0, total: 0, byTicketType: [] });
      }
      if (path.includes('/attendees')) {
        return Response.json({ items: [], total: 0, page: 1, limit: 50 });
      }
      return Response.json([]);
    });

    render(<EventDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Fiesta de primavera' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Este evento no tiene RPPs.'),
    ).toBeInTheDocument();
    const doors = await screen.findByRole('region', {
      name: 'Ingreso en puerta',
    });
    expect(await within(doors).findByText('0 de 0')).toBeInTheDocument();
    expect(
      await screen.findByText('Todavía no hay entradas emitidas.'),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/events/organizer/event-1/sales');
    expect(apiFetch).toHaveBeenCalledWith(
      '/events/organizer/event-1/promoters',
    );
    const freeTickets = screen.getByRole('region', { name: 'QR free' });
    expect(
      await within(freeTickets).findByText('Todavía no mandaste QR free.'),
    ).toBeInTheDocument();
    // Sin tipos de entrada no hay nada para mandar.
    expect(freeTickets).toHaveTextContent(
      'Creá un tipo de entrada para mandar QR free.',
    );
    expect(apiFetch).toHaveBeenCalledWith(
      '/events/organizer/event-1/free-tickets',
    );
  });

  it.each([403, 404])(
    'si el evento no es del organizador o no existe (%i), lo dice',
    async (status) => {
      vi.mocked(apiFetch).mockResolvedValue(
        Response.json({ message: 'No' }, { status }),
      );

      render(<EventDetailPage />);

      expect(
        await screen.findByText('No encontramos este evento.'),
      ).toBeInTheDocument();
    },
  );

  it('si falla la conexión, ofrece reintentar', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('sin conexión'));

    render(<EventDetailPage />);

    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
