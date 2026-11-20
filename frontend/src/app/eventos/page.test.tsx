import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EventosPage from './page';

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
    vi.clearAllMocks();
  });

  it('con mucha demanda avisa, reintenta sola y muestra los eventos', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(busy(429, '2'))
      .mockResolvedValueOnce(page(['Fiesta Bresh']));

    render(<EventosPage />);

    expect(await screen.findByText('Hay mucha gente entrando')).toBeVisible();
    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });

    expect(await screen.findByText('Fiesta Bresh')).toBeInTheDocument();
  });

  it('sin conexión ofrece reintentar ahora', async () => {
    vi.mocked(apiFetch)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(page(['Fiesta Bresh']));

    render(<EventosPage />);
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

    render(<EventosPage />);
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
