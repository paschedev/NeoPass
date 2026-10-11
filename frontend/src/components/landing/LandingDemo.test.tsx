import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import LandingDemo from './LandingDemo';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

describe('Demo de la landing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('arranca mostrando el panel del organizador con datos de ejemplo, sin llamar a la API', () => {
    render(<LandingDemo />);

    expect(screen.getByRole('tab', { name: 'Organizador' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const panel = screen.getByRole('tabpanel', { name: 'Organizador' });
    expect(
      within(panel).getByRole('heading', { name: 'Noche de Techno' }),
    ).toBeInTheDocument();
    expect(
      within(panel).getAllByText('Lucía Fernández').length,
    ).toBeGreaterThan(0);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('la pestaña RPP muestra el panel de un RPP con varios eventos', () => {
    render(<LandingDemo />);

    fireEvent.click(screen.getByRole('tab', { name: 'RPP' }));

    const panel = screen.getByRole('tabpanel', { name: 'RPP' });
    expect(
      within(panel).getByRole('region', { name: 'Tus números como RPP' }),
    ).toHaveTextContent('Te deben');
    expect(within(panel).getByText('Noche de Techno')).toBeInTheDocument();
    expect(within(panel).getByText('Sunset en la Terraza')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('es una vitrina: el panel se mira pero no se puede tocar', () => {
    render(<LandingDemo />);

    expect(
      screen.getByRole('tabpanel', { name: 'Organizador' }),
    ).toHaveAttribute('inert');
  });
});
