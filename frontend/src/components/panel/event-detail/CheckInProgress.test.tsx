import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import CheckInProgress from './CheckInProgress';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const checkIns = (checkedIn: number) => ({
  checkedIn,
  total: 3,
  byTicketType: [
    { name: 'General', batch: 'Preventa', checkedIn, total: 2 },
    { name: 'Campo', batch: 'General', checkedIn: 0, total: 1 },
  ],
});

describe('CheckInProgress', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('muestra cuántos ingresaron sobre el total y por tipo de entrada', async () => {
    vi.mocked(apiFetch).mockImplementation(async () =>
      Response.json(checkIns(1)),
    );

    render(<CheckInProgress eventId="e1" live={false} />);

    expect(await screen.findByText('1 de 3')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/events/organizer/e1/check-ins');
    expect(
      screen.getByRole('progressbar', { name: 'Ingresaron' }),
    ).toHaveAttribute('aria-valuenow', '33');
    expect(screen.getByText('Preventa · General')).toBeInTheDocument();
    expect(screen.getByText('1 de 2')).toBeInTheDocument();
  });

  it('con el evento en curso se actualiza solo cada 30 segundos', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.mocked(apiFetch)
      .mockImplementationOnce(async () => Response.json(checkIns(1)))
      .mockImplementation(async () => Response.json(checkIns(2)));

    render(<CheckInProgress eventId="e1" live />);
    expect(await screen.findByText('1 de 3')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });

    expect(await screen.findByText('2 de 3')).toBeInTheDocument();
    expect(screen.getByText(/se actualiza solo/i)).toBeInTheDocument();
  });

  it('fuera del evento no se actualiza solo', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.mocked(apiFetch).mockImplementation(async () =>
      Response.json(checkIns(1)),
    );

    render(<CheckInProgress eventId="e1" live={false} />);
    await screen.findByText('1 de 3');
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });
});
