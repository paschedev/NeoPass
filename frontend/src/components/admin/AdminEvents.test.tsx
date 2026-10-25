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
  deletedByNeoPass: null,
  neoPassFeePercentage: '15',
  organizer: { name: 'Productora Sur', email: 'sur@neopass.test' },
  sales: { sold: 0, capacity: 100, revenue: 0, marketplaceFee: 0 },
  ...overrides,
});
const deleted = { deletedAt: at(-1), deletedByNeoPass: true };

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

const onSearch = vi.fn();
const renderEvents = (search = '') =>
  render(<AdminEvents search={search} onSearch={onSearch} />);

const eventCard = (title: string) =>
  screen.findByRole('article', { name: title });

describe('Panel ADMIN: eventos', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lista los eventos con su organizador, su estado y su cargo', async () => {
    server(eventsPage([adminEvent()]));

    renderEvents();

    const card = await eventCard('Fiesta de primavera');
    expect(card).toHaveTextContent('Productora Sur');
    expect(card).toHaveTextContent('sur@neopass.test');
    expect(card).toHaveTextContent('PUBLICADO');
    expect(card).toHaveTextContent('Cargo: 15 %');
    expect(apiFetch).toHaveBeenCalledWith('/admin/events?page=1');
  });

  it('busca por nombre del evento o email del organizador', async () => {
    server(eventsPage([adminEvent()]));
    renderEvents();
    await eventCard('Fiesta de primavera');

    fireEvent.change(
      screen.getByRole('searchbox', {
        name: 'Buscar por evento o email del organizador',
      }),
      { target: { value: ' primavera ' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(onSearch).toHaveBeenCalledWith('primavera');
  });

  it('pide los eventos que coinciden con la búsqueda', async () => {
    server(eventsPage([adminEvent()]));

    renderEvents('primavera');

    await eventCard('Fiesta de primavera');
    expect(apiFetch).toHaveBeenCalledWith('/admin/events?q=primavera&page=1');
    expect(
      screen.getByRole('searchbox', {
        name: 'Buscar por evento o email del organizador',
      }),
    ).toHaveValue('primavera');
  });

  it('pasa de página de a 20 eventos', async () => {
    server(eventsPage([adminEvent()], { total: 25 }));
    renderEvents();
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

      renderEvents();

      const card = await eventCard('Fiesta de primavera');
      expect(
        within(card).queryByRole('button', { name: /cambiar el cargo/i }),
      ).not.toBeInTheDocument();
    },
  );

  it('cambiar el cargo muestra cuánto paga quien compra, cuánto se queda NeoPass y cuánto recibe el organizador, y lo guarda', async () => {
    server(
      eventsPage([adminEvent()]),
      Response.json({ id: 'e1', neoPassFeePercentage: '8.5' }),
    );
    renderEvents();
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
      'Pasa de 15 % a 8,5 %: una entrada de $10.000 le cuesta $11.147 a quien compra. NeoPass se queda con $553 y el organizador recibe $9.703,80 después de Mercado Pago.',
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
    renderEvents();
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
    renderEvents();
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

  it('muestra las entradas vendidas sobre el total, lo recaudado y lo que se quedó NeoPass', async () => {
    server(
      eventsPage([
        adminEvent({
          sales: {
            sold: 120,
            capacity: 300,
            revenue: 1200000,
            marketplaceFee: 96000,
          },
        }),
      ]),
    );

    renderEvents();

    const card = await eventCard('Fiesta de primavera');
    expect(card).toHaveTextContent('120 de 300 vendidas');
    expect(card).toHaveTextContent('Recaudado $1.200.000');
    expect(card).toHaveTextContent('Para NeoPass $96.000');
  });

  it.each([
    ['NeoPass', true, 'por NeoPass'],
    ['su organizador', false, 'por el organizador'],
  ])(
    'un evento que eliminó %s dice cuándo y quién',
    async (_, deletedByNeoPass, who) => {
      server(
        eventsPage([
          adminEvent({ deletedAt: '2026-10-12T17:05:00.000Z', deletedByNeoPass }),
        ]),
      );

      renderEvents();

      expect(await eventCard('Fiesta de primavera')).toHaveTextContent(
        `Eliminado el 12 oct, 14:05 ${who}`,
      );
    },
  );

  it('un evento vigente se puede dar de baja y uno eliminado se puede restaurar', async () => {
    server(
      eventsPage([
        adminEvent(),
        adminEvent({ id: 'e2', title: 'Noche de techno', ...deleted }),
      ]),
    );

    renderEvents();

    const live = await eventCard('Fiesta de primavera');
    expect(
      within(live).getByRole('button', {
        name: 'Dar de baja Fiesta de primavera',
      }),
    ).toBeInTheDocument();
    expect(
      within(live).queryByRole('button', { name: /restaurar/i }),
    ).not.toBeInTheDocument();
    const gone = await eventCard('Noche de techno');
    expect(
      within(gone).getByRole('button', { name: 'Restaurar Noche de techno' }),
    ).toBeInTheDocument();
    expect(
      within(gone).queryByRole('button', { name: /dar de baja/i }),
    ).not.toBeInTheDocument();
  });

  it('ofrece ver la página pública solo de un evento publicado que no terminó', async () => {
    server(
      eventsPage([
        adminEvent(),
        adminEvent({ id: 'e2', title: 'Noche de techno', status: 'FINISHED' }),
        adminEvent({ id: 'e3', title: 'Fiesta de otoño', ...deleted }),
      ]),
    );

    renderEvents();

    expect(
      within(await eventCard('Fiesta de primavera')).getByRole('link', {
        name: 'Ver página pública',
      }),
    ).toHaveAttribute('href', '/eventos/e1');
    for (const title of ['Noche de techno', 'Fiesta de otoño']) {
      expect(
        within(await eventCard(title)).queryByRole('link', {
          name: 'Ver página pública',
        }),
      ).not.toBeInTheDocument();
    }
  });

  it('dar de baja usa el aviso de la página pública y la tarjeta pasa a eliminada', async () => {
    server(eventsPage([adminEvent()]));
    renderEvents();
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Dar de baja Fiesta de primavera',
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Dar de baja «Fiesta de primavera»',
    });
    fireEvent.change(
      within(dialog).getByLabelText(/Escribí el nombre del evento/),
      { target: { value: 'Fiesta de primavera' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Dar de baja' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Evento dado de baja'),
    );
    expect(apiFetch).toHaveBeenCalledWith('/events/e1', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = await eventCard('Fiesta de primavera');
    expect(card).toHaveTextContent('ELIMINADO');
    expect(card).toHaveTextContent('por NeoPass');
    expect(
      within(card).getByRole('button', {
        name: 'Restaurar Fiesta de primavera',
      }),
    ).toBeInTheDocument();
  });

  it('restaurar explica qué pasa, pide confirmación y la tarjeta vuelve a como estaba', async () => {
    server(
      eventsPage([adminEvent({ deletedAt: at(-1), deletedByNeoPass: false })]),
      Response.json({ id: 'e1', deletedAt: null }),
    );
    renderEvents();
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Restaurar Fiesta de primavera',
      }),
    );

    const dialog = screen.getByRole('dialog', {
      name: 'Restaurar «Fiesta de primavera»',
    });
    expect(dialog).toHaveTextContent(
      'Vuelve a la vista pública y se pueden comprar entradas.',
    );
    expect(dialog).toHaveTextContent(
      'Sus entradas vuelven a servir para entrar y avisamos a quienes las tienen.',
    );
    expect(dialog).toHaveTextContent('Avisamos al organizador.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Restaurar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Evento restaurado'),
    );
    expect(apiFetch).toHaveBeenCalledWith('/admin/events/e1/restore', {
      method: 'PATCH',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = await eventCard('Fiesta de primavera');
    expect(card).not.toHaveTextContent('ELIMINADO');
    expect(card).not.toHaveTextContent('Eliminado el');
    expect(
      within(card).getByRole('button', {
        name: 'Dar de baja Fiesta de primavera',
      }),
    ).toBeInTheDocument();
  });

  it('restaurar un evento que ya no vende avisa que vuelve a su historial', async () => {
    server(
      eventsPage([
        adminEvent({ startDate: at(-30), endDate: at(-24), ...deleted }),
      ]),
    );
    renderEvents();
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Restaurar Fiesta de primavera',
      }),
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Ya no vende entradas: vuelve a su historial.',
    );
    expect(dialog).not.toHaveTextContent('se pueden comprar entradas');
    expect(dialog).toHaveTextContent('Avisamos al organizador.');
  });

  it('si el servidor no lo restaura, muestra su motivo', async () => {
    server(
      eventsPage([adminEvent(deleted)]),
      Response.json(
        { message: 'El evento no está eliminado.' },
        { status: 409 },
      ),
    );
    renderEvents();
    fireEvent.click(
      within(await eventCard('Fiesta de primavera')).getByRole('button', {
        name: 'Restaurar Fiesta de primavera',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Restaurar',
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('El evento no está eliminado.'),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('si la lista no carga, ofrece reintentar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    renderEvents();

    expect(
      await screen.findByText('No pudimos cargar los eventos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
