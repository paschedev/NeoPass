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
import AdminTickets from './AdminTickets';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const HOUR_MS = 60 * 60 * 1000;
const at = (hours: number) =>
  new Date(Date.now() + hours * HOUR_MS).toISOString();

const adminTicket = (overrides = {}, event = {}) => ({
  id: '1a2b3c4d-0000-4000-8000-000000000001',
  code: '1A2B3C4D',
  status: 'VALID',
  usedAt: null,
  event: {
    id: 'e1',
    title: 'Fiesta de primavera',
    status: 'PUBLISHED',
    startDate: at(24),
    endDate: at(30),
    deletedAt: null,
    ...event,
  },
  ticketType: { name: 'General', batchName: 'Preventa' },
  owner: { name: 'Ana Pérez', email: 'ana@example.com' },
  buyer: null,
  origin: {
    type: 'PURCHASE',
    purchasedAt: '2026-10-10T21:20:00.000Z',
    total: 12000,
    promoterName: null,
  },
  ...overrides,
});

const ticketsPage = (items: object[], overrides = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  ...overrides,
});

// Responde la lista con `page` y el reenvío con `resent`.
function server(
  page: object,
  resent: Response = Response.json({ sentTo: 'ana@example.com' }),
) {
  vi.mocked(apiFetch).mockImplementation(async (url, options) =>
    options?.method === 'POST' ? resent : Response.json(page),
  );
}

const onSearch = vi.fn();
const renderTickets = (search = '') =>
  render(<AdminTickets search={search} onSearch={onSearch} />);

const ticketCard = (code = '1A2B3C4D') =>
  screen.findByRole('article', { name: `Entrada ${code}` });

describe('Panel ADMIN: tickets', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lista las entradas con su código, su estado, el evento, el dueño y la compra', async () => {
    server(ticketsPage([adminTicket()]));

    renderTickets();

    const card = await ticketCard();
    expect(card).toHaveTextContent('VÁLIDA');
    expect(card).toHaveTextContent('Fiesta de primavera');
    expect(card).toHaveTextContent('PUBLICADO');
    expect(card).toHaveTextContent('General · Preventa');
    expect(card).toHaveTextContent('Ana Pérez · ana@example.com');
    expect(card).toHaveTextContent('Compra del 10 oct, 18:20 · $12.000 en total');
    expect(card).not.toHaveTextContent('La compró');
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets?page=1');
  });

  it('pide las entradas que coinciden con la búsqueda', async () => {
    server(ticketsPage([adminTicket()]));

    renderTickets('ana@');

    await ticketCard();
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets?q=ana%40&page=1');
    expect(
      screen.getByRole('searchbox', { name: 'Buscar por código o correo' }),
    ).toHaveValue('ana@');
  });

  it('buscar avisa qué se buscó, sin espacios de más', async () => {
    server(ticketsPage([adminTicket()]));
    renderTickets();
    await ticketCard();

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar por código o correo' }),
      { target: { value: ' 1a2b3c4d ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onSearch).toHaveBeenCalledWith('1a2b3c4d');
  });

  it('una entrada transferida dice quién la compró y por qué RPP', async () => {
    server(
      ticketsPage([
        adminTicket({
          buyer: { name: 'Juan Gómez', email: 'juan@example.com' },
          origin: {
            type: 'PURCHASE',
            purchasedAt: '2026-10-10T21:20:00.000Z',
            total: 24000,
            promoterName: 'Lucía',
          },
        }),
      ]),
    );

    renderTickets();

    const card = await ticketCard();
    expect(card).toHaveTextContent('La compró');
    expect(card).toHaveTextContent('Juan Gómez · juan@example.com');
    expect(card).toHaveTextContent('$24.000 en total · RPP Lucía');
  });

  it('un QR free dice quién lo mandó y hasta qué hora deja entrar', async () => {
    server(
      ticketsPage([
        adminTicket({
          owner: { name: null, email: 'invitada@example.com' },
          origin: {
            type: 'FREE',
            sentBy: 'Productora Sur',
            validUntil: '2026-10-18T04:00:00.000Z',
          },
        }),
      ]),
    );

    renderTickets();

    const card = await ticketCard();
    expect(card).toHaveTextContent('invitada@example.com');
    expect(card).toHaveTextContent(
      'QR free de Productora Sur · Entra hasta el 18 oct, 01:00',
    );
  });

  it('una entrada usada dice cuándo ingresó', async () => {
    server(
      ticketsPage([
        adminTicket({ status: 'USED', usedAt: '2026-10-10T02:40:00.000Z' }),
      ]),
    );

    renderTickets();

    const card = await ticketCard();
    expect(card).toHaveTextContent('USADA');
    expect(card).toHaveTextContent('Ingresó el 9 oct, 23:40');
  });

  it('ver el evento lleva a la pestaña Eventos con ese evento buscado', async () => {
    server(ticketsPage([adminTicket()]));

    renderTickets();

    expect(
      within(await ticketCard()).getByRole('link', { name: 'Ver el evento' }),
    ).toHaveAttribute(
      'href',
      '/panel/admin?tab=eventos&q=Fiesta+de+primavera',
    );
  });

  it('reenviar pide confirmación mostrando a qué correo va y avisa cuando sale', async () => {
    server(ticketsPage([adminTicket()]));
    renderTickets();
    fireEvent.click(
      within(await ticketCard()).getByRole('button', {
        name: 'Reenviar la entrada 1A2B3C4D',
      }),
    );

    const dialog = screen.getByRole('dialog', { name: 'Reenviar la entrada' });
    expect(dialog).toHaveTextContent('Le llega a ana@example.com.');
    expect(dialog).toHaveTextContent('Es la misma entrada: el QR no cambia.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reenviar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Entrada reenviada a ana@example.com',
      ),
    );
    expect(apiFetch).toHaveBeenCalledWith(
      '/admin/tickets/1a2b3c4d-0000-4000-8000-000000000001/resend',
      { method: 'POST' },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it.each([
    ['usada', { status: 'USED', usedAt: at(-1) }, {}],
    ['anulada', { status: 'CANCELLED' }, {}],
    ['devuelta', { status: 'REFUNDED' }, {}],
    ['de un evento eliminado', {}, { deletedAt: at(-1) }],
    ['de un evento que terminó', {}, { startDate: at(-8), endDate: at(-2) }],
  ])('no ofrece reenviar una entrada %s', async (_, overrides, event) => {
    server(ticketsPage([adminTicket(overrides, event)]));

    renderTickets();

    expect(
      within(await ticketCard()).queryByRole('button', { name: /reenviar/i }),
    ).not.toBeInTheDocument();
  });

  it('si el servidor no la reenvía, muestra su motivo y deja la confirmación abierta', async () => {
    server(
      ticketsPage([adminTicket()]),
      Response.json(
        { message: 'Solo se reenvían las entradas válidas.' },
        { status: 409 },
      ),
    );
    renderTickets();
    fireEvent.click(
      within(await ticketCard()).getByRole('button', {
        name: 'Reenviar la entrada 1A2B3C4D',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reenviar',
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Solo se reenvían las entradas válidas.',
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pasado el tope de reenvíos lo dice en castellano', async () => {
    server(
      ticketsPage([adminTicket()]),
      Response.json(
        { message: 'ThrottlerException: Too Many Requests' },
        { status: 429 },
      ),
    );
    renderTickets();
    fireEvent.click(
      within(await ticketCard()).getByRole('button', {
        name: 'Reenviar la entrada 1A2B3C4D',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reenviar',
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Llegaste al tope de reenvíos. Probá de nuevo en un rato.',
      ),
    );
  });

  it('pasa de página de a 20 entradas', async () => {
    server(ticketsPage([adminTicket()], { total: 25 }));
    renderTickets();
    await ticketCard();

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith('/admin/tickets?page=2'),
    );
  });

  it('sin resultados lo dice', async () => {
    server(ticketsPage([]));

    renderTickets('nadie@example.com');

    expect(
      await screen.findByText('No hay entradas que coincidan con la búsqueda.'),
    ).toBeInTheDocument();
  });

  it('si la lista no carga, ofrece reintentar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    renderTickets();

    expect(
      await screen.findByText('No pudimos cargar las entradas.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
