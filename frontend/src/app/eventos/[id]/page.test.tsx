import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  neoPassFeePercentage: '15',
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
});
