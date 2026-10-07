import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import AdminPage from './page';

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

  it('al ADMIN le muestra los eventos de NeoPass', async () => {
    session('ADMIN');
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ items: [], total: 0, page: 1, limit: 20 }),
    );

    render(<AdminPage />);

    expect(
      screen.getByRole('heading', { name: 'Administración' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Todavía no hay eventos.'),
    ).toBeInTheDocument();
  });
});
