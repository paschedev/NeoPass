import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import PasswordSection from './PasswordSection';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const user = {
  id: 'u1',
  email: 'orga@neopass.test',
  name: 'Orga',
  role: 'ORGANIZER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function fill(current: string, password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText('Contraseña actual'), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText('Nueva contraseña'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña nueva'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
}

describe('PasswordSection', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token-viejo');
    localStorage.setItem('user', JSON.stringify(user));
    render(<PasswordSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('no envía una contraseña nueva de menos de 8 caracteres', async () => {
    fill('clave-actual-123', 'corta7');

    expect(
      await screen.findByText('Tiene que tener al menos 8 caracteres'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('no envía si la confirmación no coincide', async () => {
    fill('clave-actual-123', 'clave-nueva-456', 'otra-clave-789');

    expect(
      await screen.findByText('Las contraseñas no coinciden'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('al cambiarla guarda el token nuevo y cierra el formulario', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ access_token: 'token-nuevo' }),
    );

    fill('clave-actual-123', 'clave-nueva-456');

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          oldPassword: 'clave-actual-123',
          newPassword: 'clave-nueva-456',
        }),
      }),
    );
    await waitFor(() =>
      expect(localStorage.getItem('token')).toBe('token-nuevo'),
    );
    expect(
      screen.queryByLabelText('Contraseña actual'),
    ).not.toBeInTheDocument();
  });

  it('si la contraseña actual es incorrecta muestra el mensaje del servidor', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'La contraseña actual es incorrecta' },
        { status: 400 },
      ),
    );

    fill('clave-mala-000', 'clave-nueva-456');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña actual es incorrecta',
    );
    expect(localStorage.getItem('token')).toBe('token-viejo');
  });
});
