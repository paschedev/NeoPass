import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import GlobalSidebar from './GlobalSidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/panel/tickets',
  useRouter: () => ({ push: vi.fn() }),
}));

describe('GlobalSidebar', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({ role: 'CUSTOMER' }));
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace: vi.fn() },
    });
  });

  afterEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('pide confirmación antes de cerrar la sesión', () => {
    render(<GlobalSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('jwt');
  });

  it('al confirmar borra la sesión y vuelve al inicio', () => {
    render(<GlobalSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, cerrar sesión' }));

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/');
  });

  it.each([
    [{ role: 'CUSTOMER', isCurrentlyScanner: true }, true],
    [{ role: 'CUSTOMER', hasBeenRpp: true }, true],
    [{ role: 'ORGANIZER' }, false],
    [{ role: 'CUSTOMER' }, false],
  ])('con la sesión %j muestra Staff: %s', (user, shown) => {
    localStorage.setItem('user', JSON.stringify(user));

    render(<GlobalSidebar />);

    const link = screen.queryByRole('link', { name: 'Staff' });
    expect(link !== null).toBe(shown);
    if (link) expect(link).toHaveAttribute('href', '/panel/staff');
    expect(screen.queryByText('Panel RPP')).toBeNull();
  });

  it('al cancelar la sesión sigue abierta', () => {
    render(<GlobalSidebar />);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBe('jwt');
  });
});
