import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EmailConfirmationBanner from './EmailConfirmationBanner';

const pathname = vi.hoisted(() => ({ current: '/panel' }));

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const user = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function logIn(changes: object) {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ ...user, ...changes }));
}

describe('Aviso para confirmar el correo', () => {
  afterEach(() => {
    pathname.current = '/panel';
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('sin confirmar invita a hacerlo desde Configuración', () => {
    logIn({ emailVerified: false });

    render(<EmailConfirmationBanner />);

    expect(screen.getByRole('status')).toHaveTextContent('Confirmá tu correo');
    expect(screen.getByRole('link', { name: 'Confirmar' })).toHaveAttribute(
      'href',
      '/panel/configuracion#correo',
    );
  });

  it('con el correo confirmado no aparece', () => {
    logIn({ emailVerified: true });

    render(<EmailConfirmationBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('en Configuración no aparece: ahí ya está la sección del correo', () => {
    logIn({ emailVerified: false });
    pathname.current = '/panel/configuracion';

    render(<EmailConfirmationBanner />);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('una sesión de antes que no sabe si está confirmado trae el perfil una vez', async () => {
    logIn({});
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ ...user, emailVerified: false }),
    );

    render(<EmailConfirmationBanner />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Confirmá tu correo',
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(1));
    expect(apiFetch).toHaveBeenCalledWith('/auth/me');
  });
});
