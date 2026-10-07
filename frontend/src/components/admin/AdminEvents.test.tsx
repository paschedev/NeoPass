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
import AdminEvents from './AdminEvents';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const HOUR_MS = 60 * 60 * 1000;
const at = (hours: number) =>
  new Date(Date.now() + hours * HOUR_MS).toISOString();

const adminEvent = (overrides = {}) => ({
  id: 'e1',
  title: 'Fiesta de primavera',
  status: 'PUBLISHED',
  startDate: at(24),
  endDate: at(30),
  deletedAt: null,
  neoPassFeePercentage: '15',
  organizer: { name: 'Productora Sur', email: 'sur@neopass.test' },
  ...overrides,
});

const eventsPage = (items: object[], overrides = {}) => ({
  items,
  total: items.length,
  page: 1,
  limit: 20,
  ...overrides,
});

// Responde las consultas de la lista con `page` y el cambio de cargo con `saved`.
function server(page: object, saved: Response = Response.json({})) {
  vi.mocked(apiFetch).mockImplementation(async (url, options) =>
    options?.method === 'PATCH' ? saved : Response.json(page),
  );
}

const eventCard = (title: string) =>
  screen.findByRole('article', { name: title });

describe('Panel ADMIN: eventos', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lista los eventos con su organizador, su estado y su cargo', async () => {
    server(eventsPage([adminEvent()]));

    render(<AdminEvents />);

    const card = await eventCard('Fiesta de primavera');
    expect(card).toHaveTextContent('Productora Sur');
    expect(card).toHaveTextContent('sur@neopass.test');
    expect(card).toHaveTextContent('PUBLICADO');
    expect(card).toHaveTextContent('Cargo: 15 %');
    expect(apiFetch).toHaveBeenCalledWith('/admin/events?page=1');
  });

  it('busca por nombre del evento o email del organizador', async () => {
    server(eventsPage([adminEvent()]));
    render(<AdminEvents />);
    await eventCard('Fiesta de primavera');

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Buscar por evento o email del organizador',
      }),
      { target: { value: ' primavera ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith(
        '/admin/events?q=primavera&page=1',
      ),
    );
  });

  it('pasa de página de a 20 eventos', async () => {
    server(eventsPage([adminEvent()], { total: 25 }));
    render(<AdminEvents />);
    await eventCard('Fiesta de primavera');

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenLastCalledWith('/admin/events?page=2'),
    );
  });

  it.each([
    ['terminó', { status: 'FINISHED' }],
    ['se eliminó', { deletedAt: at(-1) }],
    ['ya pasó su fin', { startDate: at(-6), endDate: at(-1) }],
  ])(
    'un evento que %s ya no vende: no ofrece cambiar su cargo',
    async (_, overrides) => {
      server(eventsPage([adminEvent(overrides)]));

      render(<AdminEvents />);

      const card = await eventCard('Fiesta de primavera');
      expect(
        within(card).queryByRole('button', { name: /cambiar el cargo/i }),
      ).not.toBeInTheDocument();
    },
  );

  it('cambiar el cargo muestra cuánto paga quien compra y lo guarda', async () => {
    server(
      eventsPage([adminEvent()]),
      Response.json({ id: 'e1', neoPassFeePercentage: '8.5' }),
    );
    render(<AdminEvents />);
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Cambiar el cargo de Fiesta de primavera',
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Cargo de servicio de Fiesta de primavera',
    });
    fireEvent.change(
      within(dialog).getByLabelText('Cargo de servicio (%)'),
      { target: { value: '8,5' } },
    );
    expect(dialog).toHaveTextContent(
      'Pasa de 15 % a 8,5 %: una entrada de $10.000 le cuesta $10.850 a quien compra.',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Cargo actualizado'),
    );
    expect(apiFetch).toHaveBeenCalledWith('/admin/events/e1/service-fee', {
      method: 'PATCH',
      body: JSON.stringify({ percentage: 8.5 }),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await eventCard('Fiesta de primavera')).toHaveTextContent(
      'Cargo: 8,5 %',
    );
  });

  it('un cargo de más de 100 % no se manda', async () => {
    server(eventsPage([adminEvent()]));
    render(<AdminEvents />);
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Cambiar el cargo de Fiesta de primavera',
      }),
    );
    const dialog = screen.getByRole('dialog');

    fireEvent.change(
      within(dialog).getByLabelText('Cargo de servicio (%)'),
      { target: { value: '150' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(
      await within(dialog).findByText('El cargo puede ser de hasta 100 %'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalledWith(
      '/admin/events/e1/service-fee',
      expect.anything(),
    );
  });

  it('si el servidor rechaza el cambio, muestra su motivo', async () => {
    server(
      eventsPage([adminEvent()]),
      Response.json(
        {
          message:
            'El evento ya no vende entradas: su cargo no se puede cambiar.',
        },
        { status: 409 },
      ),
    );
    render(<AdminEvents />);
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Cambiar el cargo de Fiesta de primavera',
      }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(
      within(dialog).getByLabelText('Cargo de servicio (%)'),
      { target: { value: '8' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'El evento ya no vende entradas: su cargo no se puede cambiar.',
      ),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('si la lista no carga, ofrece reintentar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    render(<AdminEvents />);

    expect(
      await screen.findByText('No pudimos cargar los eventos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
