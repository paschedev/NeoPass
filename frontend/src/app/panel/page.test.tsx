import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import OrganizerDashboard from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

describe('Panel del organizador', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('la pestaña de su equipo se llama "Mi staff"', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ role: 'ORGANIZER', hasLinkedMp: true }),
    );
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      Response.json(
        path === '/events/organizer/stats'
          ? {
              totalEvents: 0,
              totalTicketsSold: 0,
              totalRevenue: 0,
              activeEvents: 0,
              chartData: [],
              recentTransactions: [],
            }
          : [],
      ),
    );

    render(<OrganizerDashboard />);

    expect(
      await screen.findByRole('button', { name: 'Mi staff' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Staff & RPPs')).toBeNull();
  });
});
