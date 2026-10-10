import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import EmailCodeStep from './EmailCodeStep';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const profile = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  emailVerified: true,
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function renderStep(resend = vi.fn().mockResolvedValue(Response.json({}))) {
  const onConfirmed = vi.fn();
  render(
    <EmailCodeStep
      sentTo="ana@gmail.com"
      resend={resend}
      onConfirmed={onConfirmed}
    />,
  );
  return { onConfirmed, resend };
}

const typeCode = (code: string) =>
  fireEvent.change(screen.getByLabelText('Código'), {
    target: { value: code },
  });

describe('EmailCodeStep', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'token');
    localStorage.setItem(
      'user',
      JSON.stringify({ ...profile, emailVerified: false }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('dice a qué correo se mandó el código', () => {
    renderStep();

    expect(
      screen.getByText(/Te mandamos un código de 6 números a/),
    ).toHaveTextContent('ana@gmail.com');
  });

  it('con el código correcto guarda el perfil confirmado y avisa', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json(profile));
    const { onConfirmed } = renderStep();

    typeCode('04 82-13');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(onConfirmed).toHaveBeenCalledWith(profile));
    expect(apiFetch).toHaveBeenCalledWith('/auth/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: '048213' }),
    });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({
      emailVerified: true,
    });
  });

  it('no deja confirmar hasta tener los 6 números', () => {
    renderStep();

    typeCode('0482');

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('con un código incorrecto muestra lo que dice el servidor', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'El código no es correcto. Te quedan 4 intentos.' },
        { status: 400 },
      ),
    );
    const { onConfirmed } = renderStep();

    typeCode('111111');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El código no es correcto. Te quedan 4 intentos.',
    );
    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it('se puede reenviar recién al minuto, con cuenta regresiva', async () => {
    vi.useFakeTimers();
    const { resend } = renderStep();

    expect(
      screen.getByRole('button', { name: 'Reenviar código en 60 s' }),
    ).toBeDisabled();
    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }));

    await act(async () => {});
    expect(resend).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Reenviar código en 60 s' }),
    ).toBeDisabled();
  });

  it('si el reenvío falla muestra el motivo', async () => {
    vi.useFakeTimers();
    renderStep(
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { message: 'Llegaste al máximo de 5 códigos por hora.' },
            { status: 429 },
          ),
        ),
    );

    act(() => vi.advanceTimersByTime(60_000));
    fireEvent.click(screen.getByRole('button', { name: 'Reenviar código' }));
    await act(async () => {});

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Llegaste al máximo de 5 códigos por hora.',
    );
  });
});
