import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import RegistroPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

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
  beforeEach(() => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ id: 'u1' }));
  });

  afterEach(() => vi.clearAllMocks());

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
});
