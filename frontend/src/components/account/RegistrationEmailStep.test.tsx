import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RegistrationEmailStep from './RegistrationEmailStep';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/components/auth/ConnectGoogle', () => ({
  default: () => <button type="button">Continuar con Google</button>,
}));

const base = {
  id: 'u1',
  email: 'orga@neopass.test',
  name: 'Orga',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};
const organizer = { ...base, role: 'ORGANIZER' as const };
const buyer = { ...base, role: 'CUSTOMER' as const };

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('RegistrationEmailStep', () => {
  it('con Google configurado, quien organiza ve la invitación a conectarlo y la puede omitir', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      'neopass.apps.googleusercontent.com',
    );
    render(<RegistrationEmailStep user={organizer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

    expect(
      screen.getByRole('heading', { name: 'Conectá tu cuenta de Google' }),
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Omitir por ahora' }));
    expect(replace).toHaveBeenCalledWith('/panel');
  });

  it('sin Google configurado va directo al panel', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    render(<RegistrationEmailStep user={organizer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

    expect(replace).toHaveBeenCalledWith('/panel');
  });

  it('quien compra no ve la invitación: ya tiene el botón de Google al entrar', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      'neopass.apps.googleusercontent.com',
    );
    render(<RegistrationEmailStep user={buyer} />);

    fireEvent.click(screen.getByRole('button', { name: 'Lo hago después' }));

    expect(replace).toHaveBeenCalledWith('/panel/tickets');
  });
});
