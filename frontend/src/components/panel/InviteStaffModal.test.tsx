import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import InviteStaffModal from './InviteStaffModal';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

describe('InviteStaffModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('el rol se elige entre Scanner y Promotor', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        onInvited={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Scanner' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Promotor' }),
    ).toBeInTheDocument();
  });

  it('sin evento elegido arranca vacío y con Scanner', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Elegir un evento...' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scanner' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('abierto desde un evento, llega con ese evento y el rol ya elegidos', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[
          { id: 'e1', title: 'Fiesta de prueba' },
          { id: 'e2', title: 'Techno Sunset' },
        ]}
        initialEventId="e2"
        initialRole="RPP"
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Techno Sunset' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promotor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
