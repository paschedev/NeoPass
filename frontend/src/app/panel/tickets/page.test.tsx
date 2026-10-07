import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import MisEntradasPage from './page';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const ticket = (id: string, title: string, start: string, end: string) => ({
  id,
  status: 'VALID',
  qrCode: `qr-${id}`,
  ticketType: {
    name: 'General',
    event: {
      title,
      startDate: start,
      endDate: end,
      status: 'PUBLISHED',
      venueName: null,
      deletion: null,
    },
  },
});

describe('Mis entradas', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('las entradas de eventos terminados quedan en un historial colapsado que se abre al tocarlo', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json([
        ticket(
          'pasada',
          'Fiesta de invierno',
          '2026-01-10T23:00:00.000Z',
          '2026-01-11T07:00:00.000Z',
        ),
        ticket(
          'vigente',
          'Fiesta de primavera',
          '2099-10-10T23:00:00.000Z',
          '2099-10-11T07:00:00.000Z',
        ),
      ]),
    );

    render(<MisEntradasPage />);

    expect(await screen.findByText('Fiesta de primavera')).toBeInTheDocument();
    expect(screen.queryByText('Fiesta de invierno')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Historial \(1\)/ }));

    expect(screen.getByText('Fiesta de invierno')).toBeInTheDocument();
  });

  it('sin entradas vigentes pero con historial, avisa que no hay próximas', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json([
        ticket(
          'pasada',
          'Fiesta de invierno',
          '2026-01-10T23:00:00.000Z',
          '2026-01-11T07:00:00.000Z',
        ),
      ]),
    );

    render(<MisEntradasPage />);

    expect(
      await screen.findByText('No tenés entradas para próximos eventos.'),
    ).toBeInTheDocument();
  });
});
