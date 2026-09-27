import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PanelLayout from './layout';

const replace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
}));

describe('PanelLayout', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('con sesión muestra el contenido', () => {
    localStorage.setItem('user', JSON.stringify({ role: 'CUSTOMER' }));

    render(<PanelLayout>contenido del panel</PanelLayout>);

    expect(screen.getByText('contenido del panel')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sin sesión manda al login y no muestra el contenido', () => {
    render(<PanelLayout>contenido del panel</PanelLayout>);

    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('contenido del panel')).not.toBeInTheDocument();
  });

  it('con un usuario corrupto guardado manda al login', () => {
    localStorage.setItem('user', '{no es json');

    render(<PanelLayout>contenido del panel</PanelLayout>);

    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('contenido del panel')).not.toBeInTheDocument();
  });
});
