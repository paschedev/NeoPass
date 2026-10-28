import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'e1' }),
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const event = {
  id: 'e1',
  title: 'Fiesta Bresh',
  description: 'La fiesta',
  imageUrl: null,
  youtubeLink: null,
  startDate: '2026-11-20T02:00:00.000Z',
  endDate: '2026-11-20T08:00:00.000Z',
  venueName: 'Niceto Club',
  venueAddress: 'Niceto Vega 5510',
  venueCity: 'CABA',
  latitude: null,
  longitude: null,
  venuePlaceId: null,
  status: 'PUBLISHED',
  buyerFeePercentage: '18.15',
  organizerName: 'Productora Sur',
  ticketBatches: [],
};

describe('Página del evento', () => {
  afterEach(() => vi.clearAllMocks());

  it('dice quién organiza', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1' ? Response.json(event) : Response.json([]),
    );

    render(<EventPage />);

    expect(await screen.findByText('Organiza Productora Sur')).toBeVisible();
  });

  function onSale(buyerFeePercentage: string) {
    return {
      ...event,
      buyerFeePercentage,
      ticketBatches: [
        {
          id: 'b1',
          name: 'Primera tanda',
          saleStatus: 'ON_SALE',
          publishAt: null,
          closeAt: null,
          ticketTypes: [
            { id: 't1', name: 'General', price: '10000.00', available: 10 },
          ],
        },
      ],
    };
  }

  it('muestra el cargo de servicio como monto, sin porcentaje, y el total que cobra Mercado Pago', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1' ? Response.json(onSale('18.15')) : Response.json([]),
    );

    render(<EventPage />);
    fireEvent.click(await screen.findByRole('button', { name: '+' }));

    const fee = screen.getByText('Cargo de servicio');
    expect(fee.nextElementSibling).toHaveTextContent('$1.815');
    expect(screen.queryByText(/Cargo de servicio \(/)).not.toBeInTheDocument();
    expect(screen.getByText('$11.815')).toBeVisible();
  });

  it('calcula el cargo con el porcentaje que informa el evento para el comprador', async () => {
    // Un organizador que cobra a 35 días: el comprador paga 10,67 %.
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/events/e1' ? Response.json(onSale('10.67')) : Response.json([]),
    );

    render(<EventPage />);
    fireEvent.click(await screen.findByRole('button', { name: '+' }));

    const fee = screen.getByText('Cargo de servicio');
    expect(fee.nextElementSibling).toHaveTextContent('$1.067');
    expect(screen.getByText('$11.067')).toBeVisible();
  });
});
