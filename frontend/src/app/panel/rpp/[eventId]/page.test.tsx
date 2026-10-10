import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import RppEventDetailsPage from './page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'e1' }),
  useRouter: () => ({ back: vi.fn() }),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const stats = {
  eventName: 'Fiesta Bresh',
  totalEarned: 0,
  totalTicketsSold: 0,
  clicks: 0,
  totalPaid: 0,
  balance: 0,
  payments: [],
  staffId: 's1',
  recentSales: [],
  freeTickets: null,
};

const STATS_PATH = '/events/promoter/me/e1/stats';
const FREE_TICKETS_PATH = '/events/organizer/e1/free-tickets';

const freeTickets = (event = {}) => ({
  limit: 10,
  event: {
    status: 'PUBLISHED',
    startDate: '2026-10-11T02:00:00.000Z',
    endDate: '2026-10-11T08:00:00.000Z',
    deletedAt: null,
    ...event,
  },
  ticketBatches: [
    { name: 'Preventa', ticketTypes: [{ id: 't1', name: 'General' }] },
    { name: 'Invitados', ticketTypes: [{ id: 't2', name: 'VIP' }] },
  ],
});

const grant = {
  id: 'g1',
  recipientEmail: 'amigo@example.com',
  recipientName: null,
  ticketType: { id: 't1', name: 'General' },
  quantity: 3,
  checkedIn: 0,
  status: 'ACTIVE',
  validUntil: null,
  createdAt: '2026-10-05T15:00:00.000Z',
  lastSentAt: '2026-10-05T15:00:00.000Z',
  issuedById: 'u-rpp',
  issuedBy: { name: 'Sofía' },
};

// Las métricas del RPP, sus envíos de QR free y el resultado de mandar uno.
function server(promoterStats: object) {
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === STATS_PATH) return Response.json(promoterStats);
    if (path === FREE_TICKETS_PATH && !init?.method) {
      return Response.json([grant]);
    }
    return Response.json(grant);
  });
}

const withClipboard = (writeText: () => Promise<void>) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });

async function copyButton() {
  vi.mocked(apiFetch).mockResolvedValue(Response.json(stats));
  render(<RppEventDetailsPage />);
  return screen.findByRole('button', { name: 'Copiar link' });
}

describe('Métricas del RPP en un evento', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('con QR free, muestra cuántos le quedan y manda uno de cualquier tipo de entrada del evento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T15:00:00.000Z'));
    server({ ...stats, freeTickets: freeTickets() });
    render(<RppEventDetailsPage />);

    const section = await screen.findByRole('region', { name: 'QR free' });
    expect(
      await within(section).findByText('Te quedan 7 de tus 10 QR free.'),
    ).toBeInTheDocument();
    expect(section).toHaveTextContent('amigo@example.com');

    fireEvent.click(
      within(section).getByRole('button', { name: 'Enviar QR free' }),
    );
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('option', { name: 'VIP · Invitados' }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('Tipo de entrada'), {
      target: { value: 't2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo'), {
      target: { value: 'nuevo@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Mandamos el QR free a nuevo@example.com',
      ),
    );
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(
        ([path, options]) =>
          path === FREE_TICKETS_PATH && options?.method === 'POST',
      )!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      ticketTypeId: 't2',
      email: 'nuevo@example.com',
    });
  });

  it('sin QR free no aparece la sección ni pide sus envíos', async () => {
    server(stats);
    render(<RppEventDetailsPage />);

    await screen.findByText('Fiesta Bresh');
    expect(
      screen.queryByRole('region', { name: 'QR free' }),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([path]) => path === FREE_TICKETS_PATH),
    ).toBe(false);
  });

  it('con el evento terminado ve sus envíos pero ya no puede mandar', async () => {
    server({ ...stats, freeTickets: freeTickets({ status: 'FINISHED' }) });
    render(<RppEventDetailsPage />);

    const section = await screen.findByRole('region', { name: 'QR free' });
    expect(section).toHaveTextContent(
      'El evento terminó: ya no se pueden mandar QR free.',
    );
    expect(
      await within(section).findByText('amigo@example.com'),
    ).toBeInTheDocument();
    expect(
      within(section).queryByRole('button', { name: 'Enviar QR free' }),
    ).not.toBeInTheDocument();
  });

  it('"Copiar link" copia el link de venta del RPP y avisa que quedó copiado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard(writeText);

    fireEvent.click(await copyButton());

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/eventos/e1?rpp=s1`,
      ),
    );
    expect(toast.success).toHaveBeenCalledWith('Link copiado');
  });

  it('exportar la planilla descarga las ventas sin decir que ya se guardó', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:ventas');
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    server({
      ...stats,
      recentSales: [
        {
          id: 'o1',
          buyer: 'Ana Pérez',
          tickets: 2,
          price: 20000,
          commission: 2000,
          date: '2026-10-05T15:00:00.000Z',
        },
      ],
    });
    render(<RppEventDetailsPage />);
    await screen.findByText('Fiesta Bresh');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar planilla' }));

    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      'ventas_fiesta_bresh.csv',
    );
    expect(toast.success).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('sin ventas no descarga nada y avisa que no hay ventas para exportar', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    server(stats);
    render(<RppEventDetailsPage />);
    await screen.findByText('Fiesta Bresh');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar planilla' }));

    expect(toast.error).toHaveBeenCalledWith('No hay ventas para exportar');
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });

  it('si el navegador no deja copiar, avisa que no se pudo en vez de decir "copiado"', async () => {
    withClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')));

    fireEvent.click(await copyButton());

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('No se pudo copiar el link'),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });
});
