import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import ResetPasswordForm from './ResetPasswordForm';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

function fillPasswords(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña'), {
    target: { value: confirmation },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Guardar contraseña nueva' }),
  );
}

describe('ResetPasswordForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sin token avisa que el link no es válido y ofrece pedir otro', () => {
    render(<ResetPasswordForm token={null} />);

    expect(screen.getByText(/El link no es válido/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Pedir un link nuevo' }),
    ).toHaveAttribute('href', '/password-recovery');
  });

  it('no envía si las contraseñas no coinciden', async () => {
    render(<ResetPasswordForm token="token-del-mail" />);

    fillPasswords('clave-nueva-456', 'otra-clave-789');

    expect(
      await screen.findByText('Las contraseñas no coinciden'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('no envía una contraseña de menos de 8 caracteres', async () => {
    render(<ResetPasswordForm token="token-del-mail" />);

    fillPasswords('corta7');

    expect(
      await screen.findByText('Tiene que tener al menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('envía el token y la contraseña nueva y ofrece ir al login', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ message: 'ok' }));
    render(<ResetPasswordForm token="token-del-mail" />);

    fillPasswords('clave-nueva-456');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: 'token-del-mail',
          newPassword: 'clave-nueva-456',
        }),
      }),
    );
    expect(
      await screen.findByRole('link', { name: 'Ir a iniciar sesión' }),
    ).toHaveAttribute('href', '/login');
  });

  it('si el link venció muestra el error del servidor', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'El link para cambiar la contraseña no es válido o venció' },
        { status: 400 },
      ),
    );
    render(<ResetPasswordForm token="token-vencido" />);

    fillPasswords('clave-nueva-456');

    expect(
      await screen.findByText(
        'El link para cambiar la contraseña no es válido o venció',
      ),
    ).toBeInTheDocument();
  });
});
