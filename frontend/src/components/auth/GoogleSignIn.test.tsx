import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import GoogleSignIn from './GoogleSignIn';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
// El botón real habla con Google: acá entrega una credencial al tocarlo.
vi.mock('./GoogleButton', () => ({
  default: ({ onCredential }: { onCredential: (c: string) => void }) => (
    <button type="button" onClick={() => onCredential('credencial-de-google')}>
      Continuar con Google
    </button>
  ),
}));

const buyer = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana',
  role: 'CUSTOMER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function respond(status: number, body: unknown) {
  vi.mocked(apiFetch).mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status }),
  );
}

function sent(call: number) {
  const [url, options] = vi.mocked(apiFetch).mock.calls[call];
  return { url, body: JSON.parse(String(options?.body)) as object };
}

describe('GoogleSignIn', () => {
  const originalLocation = window.location;
  const onError = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace: vi.fn(), search: '' },
    });
    render(<GoogleSignIn onError={onError} />);
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  const tapGoogle = () =>
    fireEvent.click(
      screen.getByRole('button', { name: 'Continuar con Google' }),
    );

  it('con la cuenta ya unida, entra y recuerda que usó Google', async () => {
    respond(201, { access_token: 'jwt', user: buyer });

    tapGoogle();

    await waitFor(() =>
      expect(window.location.replace).toHaveBeenCalledWith('/panel/tickets'),
    );
    expect(sent(0)).toEqual({
      url: '/auth/google',
      body: { credential: 'credencial-de-google' },
    });
    expect(localStorage.getItem('token')).toBe('jwt');
    expect(localStorage.getItem('lastLoginMethod')).toBe('google');
  });

  describe('sin cuenta', () => {
    beforeEach(async () => {
      respond(409, {
        code: 'GOOGLE_SIGN_UP_NEEDS_TERMS',
        message: 'Para crear tu cuenta, aceptá los términos.',
        email: 'ana@gmail.com',
      });
      tapGoogle();
      await screen.findByRole('heading', { name: 'Creá tu cuenta' });
    });

    it('no crea la cuenta sin tildar la casilla', () => {
      expect(
        screen.getByText(/Vas a entrar a NeoPass con ana@gmail.com/),
      ).toBeTruthy();
      expect(
        (
          screen.getByRole('button', {
            name: 'Crear cuenta',
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    it('con la casilla crea la cuenta con los términos vigentes y ofrece crear una contraseña', async () => {
      respond(201, {
        access_token: 'jwt',
        user: { ...buyer, hasPassword: false },
      });

      fireEvent.click(
        screen.getByRole('checkbox', { name: /Soy mayor de 18 años/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      await screen.findByRole('heading', { name: 'Ya tenés tu cuenta' });
      expect(sent(1)).toEqual({
        url: '/auth/google',
        body: expect.objectContaining({
          credential: 'credencial-de-google',
          termsVersion: expect.any(Number),
          privacyVersion: expect.any(Number),
        }),
      });
      expect(localStorage.getItem('token')).toBe('jwt');
    });

    it('omitir la contraseña entra igual', async () => {
      respond(201, { access_token: 'jwt', user: buyer });
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Soy mayor de 18 años/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      await screen.findByRole('heading', { name: 'Ya tenés tu cuenta' });

      fireEvent.click(screen.getByRole('button', { name: 'Omitir por ahora' }));

      expect(window.location.replace).toHaveBeenCalledWith('/panel/tickets');
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });

    it('crear la contraseña la manda con la misma credencial y entra', async () => {
      respond(201, { access_token: 'jwt', user: buyer });
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Soy mayor de 18 años/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      await screen.findByRole('heading', { name: 'Ya tenés tu cuenta' });
      respond(201, { ...buyer, hasPassword: true });

      fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
        target: { value: 'clave-nueva-123' },
      });
      fireEvent.change(screen.getByLabelText('Repetí la contraseña'), {
        target: { value: 'clave-nueva-123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Crear contraseña' }));

      await waitFor(() =>
        expect(window.location.replace).toHaveBeenCalledWith('/panel/tickets'),
      );
      expect(sent(2)).toEqual({
        url: '/auth/google/password',
        body: {
          credential: 'credencial-de-google',
          password: 'clave-nueva-123',
        },
      });
    });

    it('si las contraseñas no coinciden no manda nada', async () => {
      respond(201, { access_token: 'jwt', user: buyer });
      fireEvent.click(
        screen.getByRole('checkbox', { name: /Soy mayor de 18 años/ }),
      );
      fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
      await screen.findByRole('heading', { name: 'Ya tenés tu cuenta' });

      fireEvent.change(screen.getByLabelText('Contraseña nueva'), {
        target: { value: 'clave-nueva-123' },
      });
      fireEvent.change(screen.getByLabelText('Repetí la contraseña'), {
        target: { value: 'otra-clave-123' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Crear contraseña' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Las contraseñas no coinciden',
      );
      expect(apiFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('con una cuenta que todavía no tiene Google', () => {
    beforeEach(async () => {
      respond(409, {
        code: 'GOOGLE_LINK_NEEDS_PASSWORD',
        message: 'Ya tenés una cuenta con este email.',
        email: 'ana@gmail.com',
      });
      tapGoogle();
      await screen.findByRole('heading', {
        name: 'Conectá tu cuenta de Google',
      });
    });

    it('con la contraseña correcta conecta y entra', async () => {
      respond(201, { access_token: 'jwt', user: buyer });

      fireEvent.change(screen.getByLabelText('Contraseña'), {
        target: { value: 'clave-de-ana' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Conectar y entrar' }),
      );

      await waitFor(() =>
        expect(window.location.replace).toHaveBeenCalledWith('/panel/tickets'),
      );
      expect(sent(1)).toEqual({
        url: '/auth/google/link',
        body: { credential: 'credencial-de-google', password: 'clave-de-ana' },
      });
    });

    it('con la contraseña incorrecta muestra el error en el cuadro', async () => {
      respond(401, { message: 'La contraseña es incorrecta', statusCode: 401 });

      fireEvent.change(screen.getByLabelText('Contraseña'), {
        target: { value: 'otra' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: 'Conectar y entrar' }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La contraseña es incorrecta',
      );
      expect(window.location.replace).not.toHaveBeenCalled();
    });
  });

  it('otro error se muestra donde la pantalla muestra los suyos', async () => {
    respond(403, {
      message: 'Tu cuenta de Google no tiene el email verificado.',
      statusCode: 403,
    });

    tapGoogle();

    await waitFor(() =>
      expect(onError).toHaveBeenLastCalledWith(
        'Tu cuenta de Google no tiene el email verificado.',
      ),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
