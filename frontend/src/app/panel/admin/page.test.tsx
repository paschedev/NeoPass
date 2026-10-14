import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import AdminPage from './page';

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => nav.params,
  useRouter: () => ({ push: nav.push }),
}));
vi.mock('@/hooks/useCurrentUser', () => ({ useCurrentUser: vi.fn() }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

function session(role: string | null) {
  vi.mocked(useCurrentUser).mockReturnValue({
    user: role ? ({ role } as ReturnType<typeof useCurrentUser>['user']) : null,
    ready: true,
    refresh: vi.fn(),
    logout: vi.fn(),
  });
}

function adminAt(query: string) {
  session('ADMIN');
  nav.params = new URLSearchParams(query);
  vi.mocked(apiFetch).mockImplementation(async () =>
    Response.json({ items: [], total: 0, page: 1, limit: 20 }),
  );
}

const tab = (name: string) => screen.getByRole('link', { name });

describe('Página del panel ADMIN', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it.each(['ORGANIZER', 'CUSTOMER', null])(
    'con la sesión %s no muestra el panel ni pide datos',
    (role) => {
      session(role);

      render(<AdminPage />);

      expect(
        screen.getByText('No tenés acceso a esta sección.'),
      ).toBeInTheDocument();
      expect(apiFetch).not.toHaveBeenCalled();
    },
  );

  it('sin pestaña en la URL abre los eventos de NeoPass', async () => {
    adminAt('');

    render(<AdminPage />);

    expect(
      screen.getByRole('heading', { name: 'Administración' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Todavía no hay eventos.'),
    ).toBeInTheDocument();
    expect(tab('Eventos')).toHaveAttribute('aria-current', 'page');
    expect(tab('Tickets')).not.toHaveAttribute('aria-current');
  });

  it('las pestañas quedan en la URL', () => {
    adminAt('');

    render(<AdminPage />);

    expect(tab('Eventos')).toHaveAttribute('href', '/panel/admin?tab=eventos');
    expect(tab('Tickets')).toHaveAttribute('href', '/panel/admin?tab=tickets');
  });

  it('abre la pestaña y la búsqueda que dice la URL', async () => {
    adminAt('tab=tickets&q=ana');

    render(<AdminPage />);

    expect(
      await screen.findByText('No hay entradas que coincidan con la búsqueda.'),
    ).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/admin/tickets?q=ana&page=1');
    expect(tab('Tickets')).toHaveAttribute('aria-current', 'page');
  });

  it('buscar deja la búsqueda en la URL, así el botón de atrás vuelve a la anterior', async () => {
    adminAt('tab=tickets');
    render(<AdminPage />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Buscar por código o correo' }),
      { target: { value: 'ana@example.com' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    await waitFor(() =>
      expect(nav.push).toHaveBeenCalledWith(
        '/panel/admin?tab=tickets&q=ana%40example.com',
        { scroll: false },
      ),
    );
  });
});
