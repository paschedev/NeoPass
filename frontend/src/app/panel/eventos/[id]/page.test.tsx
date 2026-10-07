import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import type { EventAccess, EventPermission } from '@/utils/co-organizers';
import EventDetailPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'event-1' }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const BASE = '/events/organizer/event-1';

const ALL: EventPermission[] = [
  'EDIT_EVENT',
  'MANAGE_BATCHES',
  'VIEW_SALES',
  'SEND_FREE_TICKETS',
  'VIEW_ATTENDEES',
  'MANAGE_STAFF',
];

const OWNER: EventAccess = {
  role: 'OWNER',
  permissions: ALL,
  freeTicketLimit: null,
};

const coOrganizer = (
  permissions: EventPermission[],
  freeTicketLimit: number | null = null,
): EventAccess => ({ role: 'CO_ORGANIZER', permissions, freeTicketLimit });

// GET /events/organizer/:id: el evento con lo que puede hacer quien lo pide.
const teamEvent = (access: EventAccess) => ({
  id: 'event-1',
  organizerId: 'u-owner',
  title: 'Fiesta de primavera',
  status: 'PUBLISHED',
  startDate: '2030-10-10T01:00:00.000Z',
  endDate: '2030-10-10T08:00:00.000Z',
  venueName: 'Club Central',
  venueAddress: 'Av. Corrientes 1234',
  ticketBatches: [
    {
      id: 'b1',
      name: 'Preventa',
      ticketTypes: [{ id: 't1', name: 'General' }],
    },
  ],
  access,
});

const SALES = {
  event: teamEvent(OWNER),
  totals: {
    revenue: 0,
    sold: 0,
    reserved: 0,
    capacity: 100,
    checkedIn: 0,
    refundedOrders: 0,
  },
  batches: [],
};

function server(access: EventAccess) {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === BASE) return Response.json(teamEvent(access));
    if (path.endsWith('/sales')) return Response.json(SALES);
    if (path.endsWith('/check-ins')) {
      return Response.json({ checkedIn: 0, total: 0, byTicketType: [] });
    }
    if (path.includes('/attendees') || path.includes('/activity')) {
      return Response.json({ items: [], total: 0, page: 1, limit: 50 });
    }
    return Response.json([]);
  });
}

const requested = (prefix: string) =>
  vi
    .mocked(apiFetch)
    .mock.calls.some(([path]) => String(path).startsWith(`${BASE}${prefix}`));

const region = (name: string) => screen.findByRole('region', { name });

describe('Detalle del evento', () => {
  afterEach(() => vi.clearAllMocks());

  it('quien organiza ve todo: ventas, ingreso, RPPs, QR free, público, co-organizadores e historial', async () => {
    server(OWNER);

    render(<EventDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Fiesta de primavera' }),
    ).toBeInTheDocument();
    expect(await region('Resumen')).toBeInTheDocument();
    const doors = await region('Ingreso en puerta');
    expect(await within(doors).findByText('0 de 0')).toBeInTheDocument();
    const promoters = await region('RPPs');
    expect(
      await within(promoters).findByText('Este evento no tiene RPPs.'),
    ).toBeInTheDocument();
    expect(
      within(promoters).getByRole('button', { name: 'Invitar scanner o RPP' }),
    ).toBeInTheDocument();
    const freeTickets = await region('QR free');
    expect(
      await within(freeTickets).findByText('Todavía no mandaste QR free.'),
    ).toBeInTheDocument();
    expect(
      await within(await region('Público')).findByText(
        'Todavía no hay entradas emitidas.',
      ),
    ).toBeInTheDocument();
    const coOrganizers = await region('Co-organizadores');
    expect(
      await within(coOrganizers).findByText(
        'Este evento no tiene co-organizadores.',
      ),
    ).toBeInTheDocument();
    const history = await region('Historial');
    expect(
      await within(history).findByText(
        'Todavía no hay cambios en este evento.',
      ),
    ).toBeInTheDocument();
    expect(requested('/sales')).toBe(true);
  });

  it('un co-organizador ve lo que tiene permitido; lo demás aparece bloqueado y no se pide', async () => {
    server(coOrganizer(['VIEW_SALES']));

    render(<EventDetailPage />);

    expect(await region('Resumen')).toBeInTheDocument();
    expect(await region('Ingreso en puerta')).toBeInTheDocument();
    expect(await region('RPPs')).toHaveTextContent(
      'No tenés permiso para manejar el staff y los pagos a RPPs',
    );
    expect(await region('QR free')).toHaveTextContent(
      'No tenés permiso para mandar QR free',
    );
    expect(await region('Público')).toHaveTextContent(
      'No tenés permiso para ver y exportar la lista del público',
    );
    expect(
      screen.queryByRole('region', { name: 'Co-organizadores' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Historial' }),
    ).not.toBeInTheDocument();
    expect(requested('/promoters')).toBe(false);
    expect(requested('/free-tickets')).toBe(false);
    expect(requested('/attendees')).toBe(false);
    expect(requested('/co-organizers')).toBe(false);
    expect(requested('/activity')).toBe(false);
  });

  it('sin "Ver ventas" no pide las ventas; con QR free y tope ve cuántos le quedan', async () => {
    server(coOrganizer(['SEND_FREE_TICKETS'], 5));

    render(<EventDetailPage />);

    expect(
      await screen.findByRole('heading', { name: 'Fiesta de primavera' }),
    ).toBeInTheDocument();
    expect(await region('Ventas')).toHaveTextContent(
      'No tenés permiso para ver ventas y recaudación',
    );
    expect(
      await screen.findByText('Te quedan 5 de tus 5 QR free.'),
    ).toBeInTheDocument();
    expect(requested('/sales')).toBe(false);
  });

  it.each([403, 404])(
    'si el evento no es suyo o no existe (%i), lo dice',
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
