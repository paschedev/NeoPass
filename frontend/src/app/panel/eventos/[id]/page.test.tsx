import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventDetailPage from './page';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'event-1' }) }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

describe('Detalle del evento', () => {
  afterEach(() => vi.clearAllMocks());

  it('pide las ventas del evento y las muestra', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({
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
      }),
    );

    render(<EventDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Fiesta de primavera' }),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/events/organizer/event-1/sales');
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
