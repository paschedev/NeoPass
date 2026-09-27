import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import Navbar from './Navbar';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/eventos' }));

describe('Navbar', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('sin sesión ofrece ingresar y no pide notificaciones', () => {
    render(<Navbar />);

    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('con sesión muestra al usuario y trae sus notificaciones', async () => {
    localStorage.setItem(
      'user',
      JSON.stringify({ name: 'Ana Gómez', email: 'ana@neopass.test' }),
    );
    vi.mocked(apiFetch).mockResolvedValue(Response.json([]));

    render(<Navbar />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ingresar' })).toBeNull();
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/notifications'),
    );
  });
});
