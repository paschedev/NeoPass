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
import CoOrganizers from './CoOrganizers';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const PATH = '/events/organizer/e1/co-organizers';

const ana = {
  id: 's1',
  status: 'ACCEPTED',
  name: 'Ana Pérez',
  email: 'ana@example.com',
  permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
  freeTicketLimit: 20,
};

const bruno = {
  id: 's2',
  status: 'PENDING',
  name: 'Bruno Díaz',
  email: 'bruno@example.com',
  permissions: [],
  freeTicketLimit: null,
};

// El servidor responde la lista (una por cada carga) y las acciones.
function server({
  lists,
  action = Response.json(ana),
}: {
  lists: unknown[][];
  action?: Response;
}) {
  let listCalls = 0;
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === PATH && !init?.method) {
      const list = lists[Math.min(listCalls, lists.length - 1)];
      listCalls += 1;
      return Response.json(list);
    }
    return action;
  });
}

const listCalls = () =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(([path, init]) => path === PATH && !init?.method);

function renderSection(canInvite = true) {
  render(
    <CoOrganizers
      event={{ id: 'e1', title: 'Fiesta de prueba' }}
      canInvite={canInvite}
    />,
  );
}

describe('CoOrganizers', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('lista a cada co-organizador con su estado y lo que puede hacer', async () => {
    server({ lists: [[ana, bruno]] });

    renderSection();

    const anaRow = await screen.findByRole('listitem', { name: 'Ana Pérez' });
    expect(anaRow).toHaveTextContent('ana@example.com');
    expect(anaRow).toHaveTextContent('Aceptó');
    expect(anaRow).toHaveTextContent(
      'Escanear · Ver ventas · QR free (hasta 20)',
    );
    const brunoRow = screen.getByRole('listitem', { name: 'Bruno Díaz' });
    expect(brunoRow).toHaveTextContent('Pendiente');
    expect(brunoRow).toHaveTextContent('Escanear');
  });

  it('sin co-organizadores lo dice', async () => {
    server({ lists: [[]] });

    renderSection();

    expect(
      await screen.findByText('Este evento no tiene co-organizadores.'),
    ).toBeInTheDocument();
  });

  it('cambiar los permisos los guarda y vuelve a cargar la lista', async () => {
    server({ lists: [[ana], [{ ...ana, permissions: ['EDIT_EVENT'] }]] });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Editar permisos de Ana Pérez',
      }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /Ver ventas y recaudación/ }),
    );
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /QR free/ }),
    );
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: /Editar la info/ }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(listCalls()).toHaveLength(2));
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === `${PATH}/s1`)!;
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({
      permissions: ['EDIT_EVENT'],
      freeTicketLimit: null,
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Guardamos los permisos de Ana Pérez',
    );
  });

  it('si el servidor rechaza el cambio, muestra el motivo y no cierra', async () => {
    server({
      lists: [[ana]],
      action: Response.json(
        { message: 'Co-organizador no encontrado' },
        { status: 404 },
      ),
    });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Editar permisos de Ana Pérez',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Co-organizador no encontrado'),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un tope inválido no se manda', async () => {
    server({ lists: [[ana]] });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Editar permisos de Ana Pérez',
      }),
    );
    fireEvent.change(screen.getByLabelText(/Tope de QR free/), {
      target: { value: '0' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(toast.error).toHaveBeenCalledWith(
      'El tope de QR free tiene que ser un número entero mayor a 0',
    );
    expect(
      vi.mocked(apiFetch).mock.calls.some(([path]) => path === `${PATH}/s1`),
    ).toBe(false);
  });

  it('quitar pide confirmación y después lo borra', async () => {
    server({ lists: [[ana], []] });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Quitar a Ana Pérez' }),
    );
    expect(
      screen.getByRole('heading', { name: '¿Quitar a Ana Pérez?' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar' }));

    await waitFor(() => expect(listCalls()).toHaveLength(2));
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === `${PATH}/s1`)!;
    expect(init?.method).toBe('DELETE');
  });

  it('en un evento terminado no se ofrece invitar', async () => {
    server({ lists: [[ana]] });

    renderSection(false);

    await screen.findByRole('listitem', { name: 'Ana Pérez' });
    expect(
      screen.queryByRole('button', { name: 'Invitar co-organizador' }),
    ).not.toBeInTheDocument();
  });

  it('invitar abre el modal con el rol de co-organizador ya elegido', async () => {
    server({ lists: [[]] });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Invitar co-organizador' }),
    );

    expect(
      screen.getByRole('button', { name: 'Co-organizador' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });
});
