import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventsList from './EventsList';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const page = (titles: string[], total = titles.length) =>
  Response.json({
    items: titles.map((title) => ({
      id: title,
      title,
      imageUrl: null,
      startDate: '2026-11-20T02:00:00.000Z',
      endDate: '2026-11-20T08:00:00.000Z',
      venueName: 'Niceto Club',
    })),
    total,
  });

const busy = (status: number, retryAfter?: string) =>
  Response.json(
    { message: 'Hay mucha demanda en este momento.' },
    { status, headers: retryAfter ? { 'Retry-After': retryAfter } : {} },
  );

describe('Lista de eventos', () => {
  afterEach(() => {
    vi.useRealTimers();
    // Reset, not clear: it also drops the answers queued with `...Once`, so a
    // test that fails does not hand its leftovers to the next one.
    vi.resetAllMocks();
  });

  it('con mucha demanda avisa, reintenta sola y muestra los eventos', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(busy(429, '2'))
      .mockResolvedValueOnce(page(['Fiesta Bresh']));

    render(<EventsList initialPage={null} />);

    expect(await screen.findByText('Hay mucha gente entrando')).toBeVisible();
    // The countdown starts in an effect, which on a busy machine can run after
    // the notice shows up: moving the clock before that leaves it stuck.
    await vi.waitFor(() => expect(vi.getTimerCount()).toBeGreaterThan(0));
    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });

    expect(await screen.findByText('Fiesta Bresh')).toBeInTheDocument();
  });

  it('sin conexión ofrece reintentar ahora', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(page(['Fiesta Bresh']));

    render(<EventsList initialPage={null} />);
    expect(
      await screen.findByText('No pudimos cargar los eventos'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar ahora' }));

    expect(await screen.findByText('Fiesta Bresh')).toBeInTheDocument();
  });

  it('si "Ver más" falla, reintenta la misma página y no se saltea ninguna', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page(['Primero'], 2))
      .mockResolvedValueOnce(busy(503))
      .mockResolvedValueOnce(page(['Segundo'], 2));

    render(<EventsList initialPage={null} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver más eventos' }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Reintentar ahora' }),
    );

    expect(await screen.findByText('Segundo')).toBeInTheDocument();
    expect(screen.getByText('Primero')).toBeInTheDocument();
    const pages = vi
      .mocked(apiFetch)
      .mock.calls.map(([path]) =>
        new URL(path, 'http://localhost').searchParams.get('page'),
      );
    expect(pages).toEqual(['1', '2', '2']);
  });
});

describe('Lista de eventos que llega armada desde el servidor', () => {
  const serverPage = (titles: string[], total = titles.length) => ({
    items: titles.map((title) => ({
      id: title,
      title,
      imageUrl: null,
      // Sábado 21 a las 23:00 en Argentina (domingo 02:00 en UTC).
      startDate: '2026-11-22T02:00:00.000Z',
      endDate: '2026-11-22T08:00:00.000Z',
      venueName: 'Niceto Club',
    })),
    total,
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('muestra los eventos con el link a cada uno sin pedirlos de nuevo', () => {
    render(<EventsList initialPage={serverPage(['Fiesta Bresh'])} />);

    expect(screen.getByRole('link', { name: /Fiesta Bresh/ })).toHaveAttribute(
      'href',
      '/eventos/Fiesta Bresh',
    );
    expect(screen.queryByText('Cargando eventos...')).not.toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('las fechas salen en hora de Argentina', () => {
    render(<EventsList initialPage={serverPage(['Fiesta Bresh'])} />);

    expect(screen.getByText('21 nov')).toBeInTheDocument();
    expect(
      screen.getByText('sáb, 21 nov, 23:00 a dom, 22 nov, 05:00'),
    ).toBeInTheDocument();
  });

  it('"Ver más" pide la página 2 y no repite la primera', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(page(['Segundo'], 2));

    render(<EventsList initialPage={serverPage(['Primero'], 2)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más eventos' }));

    expect(await screen.findByText('Segundo')).toBeInTheDocument();
    expect(screen.getAllByText('Primero')).toHaveLength(1);
    expect(vi.mocked(apiFetch).mock.calls.map(([path]) => path)).toEqual([
      '/events?page=2&limit=24',
    ]);
  });

  it('sin eventos publicados lo dice sin quedarse cargando', () => {
    render(<EventsList initialPage={serverPage([])} />);

    expect(
      screen.getByText('No hay eventos publicados en este momento.'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
