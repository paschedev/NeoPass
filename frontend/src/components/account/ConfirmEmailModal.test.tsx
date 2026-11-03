import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import ConfirmEmailModal from './ConfirmEmailModal';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const user = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
  emailVerified: false,
};

function renderModal() {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify(user));
  const onConfirmed = vi.fn();
  render(
    <ConfirmEmailModal open onClose={() => {}} onConfirmed={onConfirmed} />,
  );
  return onConfirmed;
}

describe('Confirmar el correo desde un modal', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('pide el código y pasa a escribirlo', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ sentTo: 'ana@gmail.com' }),
    );
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));

    expect(await screen.findByLabelText('Código')).toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/auth/email/verification', {
      method: 'POST',
    });
    // Recién mandado: para pedir otro hay que esperar.
    expect(
      screen.getByRole('button', { name: /Reenviar código en \d+ s/ }),
    ).toBeDisabled();
  });

  it('con un código de antes se puede pedir otro enseguida', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo un código' }));

    expect(screen.getByLabelText('Código')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reenviar código' }),
    ).toBeEnabled();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('si hay que esperar para pedir otro, lo dice y deja escribir el que ya llegó', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'Esperá 40 segundos para pedir otro código' },
        { status: 429 },
      ),
    );
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esperá 40 segundos para pedir otro código',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ya tengo un código' }));
    expect(screen.getByLabelText('Código')).toBeInTheDocument();
  });

  it('si el correo ya estaba confirmado, lo da por hecho', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) =>
      path === '/auth/me'
        ? Response.json({ ...user, emailVerified: true })
        : Response.json(
            { message: 'Tu correo ya está confirmado' },
            { status: 409 },
          ),
    );
    const onConfirmed = renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));

    await vi.waitFor(() => expect(onConfirmed).toHaveBeenCalled());
  });
});
