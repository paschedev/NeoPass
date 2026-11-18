import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import CreatePasswordForm from './CreatePasswordForm';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/auth/GoogleButton', () => ({
  default: ({ onCredential }: { onCredential: (c: string) => void }) => (
    <button type="button" onClick={() => onCredential('credencial-de-google')}>
      Continuar con Google
    </button>
  ),
}));

const user = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana',
  role: 'CUSTOMER',
  hasPassword: false,
  hasGoogle: true,
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function fill(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText('Repetí la contraseña'), {
    target: { value: confirmation },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Crear contraseña' }));
}

describe('CreatePasswordForm', () => {
  const onDone = vi.fn();

  beforeEach(() => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify(user));
    render(<CreatePasswordForm onDone={onDone} onCancel={vi.fn()} />);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('primero pide confirmar con Google', () => {
    expect(screen.getByText(/confirmá que sos vos con Google/)).toBeTruthy();
    expect(screen.queryByLabelText('Contraseña nueva')).toBeNull();
  });

  it('con Google confirmado, crea la contraseña y actualiza la sesión', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ ...user, hasPassword: true }), {
        status: 201,
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    );

    fill('clave-nueva-123');

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [url, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(url).toBe('/auth/google/password');
    expect(JSON.parse(String(options?.body))).toEqual({
      credential: 'credencial-de-google',
      password: 'clave-nueva-123',
    });
    expect(JSON.parse(localStorage.getItem('user') ?? '{}')).toMatchObject({
      hasPassword: true,
    });
  });

  it('una contraseña corta o que no coincide no se manda', async () => {
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    );

    fill('corta');
    expect(await screen.findByText('Mínimo 8 caracteres')).toBeTruthy();
    fill('clave-nueva-123', 'otra-clave-123');
    expect(
      await screen.findByText('Las contraseñas no coinciden'),
    ).toBeTruthy();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('si la confirmación de Google venció, la vuelve a pedir', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: 'No pudimos verificar tu cuenta de Google. Probá de nuevo.',
          statusCode: 401,
        }),
        { status: 401 },
      ),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    );

    fill('clave-nueva-123');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos verificar tu cuenta de Google',
    );
    expect(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    ).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});
