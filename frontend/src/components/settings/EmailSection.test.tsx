import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import EmailSection from './EmailSection';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const user = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  emailVerified: false,
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function logIn(changes: object = {}) {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ ...user, ...changes }));
}

const typeCode = (code: string) =>
  fireEvent.change(screen.getByLabelText('Código'), {
    target: { value: code },
  });

describe('Configuración: correo', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('con el correo confirmado lo muestra así y solo ofrece cambiarlo', () => {
    logIn({ emailVerified: true });

    render(<EmailSection />);

    const section = screen.getByRole('region', { name: 'Correo' });
    expect(section).toHaveTextContent('ana@gmail.com');
    expect(section).toHaveTextContent('Confirmado');
    expect(
      screen.queryByRole('button', { name: 'Confirmar mi correo' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cambiar correo' }),
    ).toBeInTheDocument();
  });

  it('sin confirmar pide el código y con él queda confirmado', async () => {
    logIn();
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/auth/email/verification'
        ? Response.json({ sentTo: 'ana@gmail.com' })
        : Response.json({ ...user, emailVerified: true }),
    );
    render(<EmailSection />);

    expect(screen.getByRole('region', { name: 'Correo' })).toHaveTextContent(
      'Sin confirmar',
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar mi correo' }),
    );
    expect(
      await screen.findByText(/Te mandamos un código de 6 números a/),
    ).toHaveTextContent('ana@gmail.com');
    typeCode('048213');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        '¡Listo! Confirmaste tu correo.',
      ),
    );
    expect(screen.getByRole('region', { name: 'Correo' })).toHaveTextContent(
      'Confirmado',
    );
  });

  it('si no se puede pedir el código muestra el motivo', async () => {
    logIn();
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'Esperá 40 segundos para pedir otro código' },
        { status: 429 },
      ),
    );
    render(<EmailSection />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar mi correo' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esperá 40 segundos para pedir otro código',
    );
  });

  it('cambiar el correo pide el nuevo y la contraseña, y con el código queda el nuevo en la sesión', async () => {
    logIn({ emailVerified: true });
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      path === '/auth/email/change'
        ? Response.json({ sentTo: 'nuevo@gmail.com' })
        : Response.json({
            ...user,
            email: 'nuevo@gmail.com',
            emailVerified: true,
          }),
    );
    render(<EmailSection />);

    fireEvent.click(screen.getByRole('button', { name: 'Cambiar correo' }));
    fireEvent.change(screen.getByLabelText('Correo nuevo'), {
      target: { value: 'nuevo@gmail.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña actual'), {
      target: { value: 'clave-segura-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Mandar código' }));
    expect(
      await screen.findByText(/Te mandamos un código de 6 números a/),
    ).toHaveTextContent('nuevo@gmail.com');
    typeCode('048213');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        'Tu correo ahora es nuevo@gmail.com',
      ),
    );
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({
      email: 'nuevo@gmail.com',
    });
    expect(screen.getByRole('region', { name: 'Correo' })).toHaveTextContent(
      'nuevo@gmail.com',
    );
  });
});
