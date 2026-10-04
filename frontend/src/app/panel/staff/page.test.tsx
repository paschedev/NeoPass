import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import StaffPage from './page';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));
vi.mock('@/components/staff/MyStaffEvents', () => ({
  default: () => <p>Lista de eventos</p>,
}));

const signIn = (user: object) =>
  localStorage.setItem('user', JSON.stringify(user));

describe('Página Staff', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it.each([
    { role: 'CUSTOMER', hasBeenRpp: true },
    { role: 'CUSTOMER', isCurrentlyScanner: true },
    { role: 'ORGANIZER', hasBeenRpp: true },
  ])('quien trabaja como staff ve sus eventos (%j)', (user) => {
    signIn(user);

    render(<StaffPage />);

    expect(
      screen.getByRole('heading', { name: 'Tus eventos como staff' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lista de eventos')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    [{ role: 'ORGANIZER' }, '/panel'],
    [{ role: 'CUSTOMER' }, '/panel/tickets'],
  ])('si no trabaja como staff (%j) vuelve a su inicio', (user, home) => {
    signIn(user);

    render(<StaffPage />);

    expect(replace).toHaveBeenCalledWith(home);
    expect(screen.queryByText('Lista de eventos')).toBeNull();
  });
});
