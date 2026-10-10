import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import RegistroPage from './page';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const newUser = {
  id: 'u1',
  email: 'juan@gmail.com',
  name: 'Juan Pérez',
  role: 'CUSTOMER',
  emailVerified: false,
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

// El registro abre la sesión; el resto de las rutas responden lo que pide
// cada caso.
function server(routes: Record<string, () => Response> = {}) {
  vi.mocked(apiFetch).mockImplementation(async (path) =>
    path === '/auth/register'
      ? Response.json({ access_token: 'token-nuevo', user: newUser })
      : (routes[path]?.() ?? Response.json({})),
  );
}

const emailInput = () => screen.getByLabelText('Correo');
const confirmEmailInput = () => screen.getByLabelText('Repetí tu correo');

function fillForm(email: string, confirmEmail: string) {
  fireEvent.change(screen.getByPlaceholderText('Juan'), {
    target: { value: 'Juan' },
  });
  fireEvent.change(screen.getByPlaceholderText('Pérez'), {
    target: { value: 'Pérez' },
  });
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(confirmEmailInput(), { target: { value: confirmEmail } });
  for (const password of screen.getAllByPlaceholderText('••••••••')) {
    fireEvent.change(password, { target: { value: 'secreta123' } });
  }
}

const createAccount = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

const sentBody = () => {
  const [, init] = vi.mocked(apiFetch).mock.calls[0];
  return JSON.parse(String(init?.body));
};

describe('Registro', () => {
  beforeEach(() => server());

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('si los dos correos no coinciden avisa y no crea la cuenta', async () => {
    render(<RegistroPage />);
    fillForm('juan@gmail.com', 'juan@gmial.com');

    createAccount();

    expect(
      await screen.findByText('Los correos no coinciden'),
    ).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('las mayúsculas o los espacios de más no cuentan como correos distintos', async () => {
    render(<RegistroPage />);
    fillForm('juan@gmail.com ', ' Juan@Gmail.com');

    createAccount();

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith(
        '/auth/register',
        expect.anything(),
      ),
    );
    expect(sentBody()).toMatchObject({ email: 'juan@gmail.com' });
    expect(sentBody()).not.toHaveProperty('confirmEmail');
  });

  it('con un dominio mal escrito sugiere el correcto y tocarlo corrige los dos campos', async () => {
    render(<RegistroPage />);
    fireEvent.change(emailInput(), { target: { value: 'juan@gmial.com' } });
    fireEvent.blur(emailInput());
    fireEvent.change(confirmEmailInput(), {
      target: { value: 'juan@gmial.com' },
    });

    expect(screen.getByText(/¿Quisiste decir/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'juan@gmail.com' }));

    await waitFor(() => expect(emailInput()).toHaveValue('juan@gmail.com'));
    expect(confirmEmailInput()).toHaveValue('juan@gmail.com');
    expect(screen.queryByText(/¿Quisiste decir/)).not.toBeInTheDocument();
  });

  it('con un dominio propio no sugiere nada', () => {
    render(<RegistroPage />);
    fireEvent.change(emailInput(), {
      target: { value: 'juan@estudio.com.ar' },
    });
    fireEvent.blur(emailInput());

    expect(screen.queryByText(/¿Quisiste decir/)).not.toBeInTheDocument();
  });

  it('acepta correos largos, de más de 38 caracteres', async () => {
    const longEmail = 'mariajose.fernandez@estudiocontable.com.ar';
    render(<RegistroPage />);
    fillForm(longEmail, longEmail);

    createAccount();

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(sentBody()).toMatchObject({ email: longEmail });
  });

  describe('después de crear la cuenta', () => {
    async function registered() {
      render(<RegistroPage />);
      fillForm('juan@gmail.com', 'juan@gmail.com');
      createAccount();
      return screen.findByText(/Te mandamos un código de 6 números a/);
    }

    it('queda con la sesión iniciada y pide el código que llegó al correo', async () => {
      const sentTo = await registered();

      expect(sentTo).toHaveTextContent('juan@gmail.com');
      expect(localStorage.getItem('token')).toBe('token-nuevo');
      expect(router.push).not.toHaveBeenCalledWith('/login');
    });

    it('con el código correcto entra a su inicio', async () => {
      server({
        '/auth/email/confirm': () =>
          Response.json({ ...newUser, emailVerified: true }),
      });
      await registered();

      fireEvent.change(screen.getByLabelText('Código'), {
        target: { value: '048213' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

      await waitFor(() =>
        expect(router.replace).toHaveBeenCalledWith('/panel/tickets'),
      );
    });

    it('"Lo hago después" entra sin confirmar', async () => {
      await registered();

      fireEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

      expect(router.replace).toHaveBeenCalledWith('/panel/tickets');
    });

    it('si el correo estaba mal escrito lo corrige con la contraseña y el código va al nuevo', async () => {
      server({
        '/auth/email/change': () =>
          Response.json({ sentTo: 'juan@hotmail.com' }),
      });
      await registered();

      fireEvent.click(
        screen.getByRole('button', { name: '¿Está mal tu correo? Corregilo' }),
      );
      fireEvent.change(screen.getByLabelText('Correo nuevo'), {
        target: { value: 'juan@hotmail.com' },
      });
      fireEvent.change(screen.getByLabelText('Contraseña actual'), {
        target: { value: 'secreta123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Mandar código' }));

      expect(
        await screen.findByText(/Te mandamos un código de 6 números a/),
      ).toHaveTextContent('juan@hotmail.com');
      expect(apiFetch).toHaveBeenCalledWith('/auth/email/change', {
        method: 'POST',
        body: JSON.stringify({
          newEmail: 'juan@hotmail.com',
          password: 'secreta123',
        }),
      });
    });
  });
});
