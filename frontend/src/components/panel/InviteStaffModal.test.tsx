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
});
