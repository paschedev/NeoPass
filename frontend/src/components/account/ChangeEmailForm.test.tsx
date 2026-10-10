import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import ChangeEmailForm from './ChangeEmailForm';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Correo nuevo'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Contraseña actual'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mandar código' }));
}

describe('ChangeEmailForm', () => {
  afterEach(() => vi.clearAllMocks());

  it('pide el código para el correo nuevo con la contraseña actual', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ sentTo: 'nuevo@gmail.com' }),
    );
    const onSent = vi.fn();
    render(<ChangeEmailForm onSent={onSent} onCancel={vi.fn()} />);

    fill(' nuevo@gmail.com ', 'clave-segura-123');

    await waitFor(() =>
      expect(onSent).toHaveBeenCalledWith(
        'nuevo@gmail.com',
        'clave-segura-123',
      ),
    );
    expect(apiFetch).toHaveBeenCalledWith('/auth/email/change', {
      method: 'POST',
      body: JSON.stringify({
        newEmail: 'nuevo@gmail.com',
        password: 'clave-segura-123',
      }),
    });
  });

  it('muestra lo que responde el servidor si no se puede', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'La contraseña es incorrecta' },
        { status: 400 },
      ),
    );
    const onSent = vi.fn();
    render(<ChangeEmailForm onSent={onSent} onCancel={vi.fn()} />);

    fill('nuevo@gmail.com', 'otra-clave');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La contraseña es incorrecta',
    );
    expect(onSent).not.toHaveBeenCalled();
  });

  it('sin un correo válido o sin contraseña no manda nada', async () => {
    render(<ChangeEmailForm onSent={vi.fn()} onCancel={vi.fn()} />);

    fill('no-es-un-correo', '');

    expect(await screen.findByText('Escribí un correo válido')).toBeVisible();
    expect(screen.getByText('Escribí tu contraseña actual')).toBeVisible();
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
