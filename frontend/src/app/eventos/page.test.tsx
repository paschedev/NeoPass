import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventosPage from './page';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const event = {
  id: '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192',
  title: 'Noche de Techno',
  imageUrl: null,
  startDate: '2026-11-22T02:00:00.000Z',
  endDate: '2026-11-22T08:00:00.000Z',
  venueName: 'Club Central',
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.neopass.ar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe('Página de eventos', () => {
  it('llega con los links a los eventos ya escritos, pedidos una vez desde el servidor', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ items: [event], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    render(await EventosPage());

    expect(
      screen.getByRole('link', { name: /Noche de Techno/ }),
    ).toHaveAttribute('href', `/eventos/${event.id}`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.neopass.ar/events?page=1&limit=24',
    );
    // Guardada un minuto y compartida entre visitas.
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      next: { revalidate: 60 },
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('si la API falla, la lista se pide desde el navegador como antes', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ items: [event], total: 1 }),
    );

    render(await EventosPage());

    expect(await screen.findByText('Noche de Techno')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/events?page=1&limit=24');
  });
});
