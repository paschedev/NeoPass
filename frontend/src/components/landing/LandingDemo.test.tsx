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
      within(panel).getByRole('heading', { name: 'Techno Night' }),
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
    expect(within(panel).getByText('Techno Night')).toBeInTheDocument();
    expect(within(panel).getByText('Beach Sunset')).toBeInTheDocument();
    expect(within(panel).getByText('Rooftop Party')).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('cada pestaña muestra entero el primer evento y deja el siguiente como adelanto, que no se lee en voz alta', () => {
    render(<LandingDemo />);

    const organizer = screen.getByRole('tabpanel', { name: 'Organizador' });
    expect(
      within(organizer).getByRole('region', { name: 'Techno Night' }),
    ).toBeInTheDocument();
    expect(
      within(organizer).queryByRole('region', { name: 'Fiesta de Primavera' }),
    ).not.toBeInTheDocument();
    expect(
      within(organizer).getByText('Fiesta de Primavera'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'RPP' }));

    const promoter = screen.getByRole('tabpanel', { name: 'RPP' });
    expect(
      within(promoter).getByRole('article', { name: 'Techno Night' }),
    ).toBeInTheDocument();
    expect(
      within(promoter).queryByRole('article', { name: 'Beach Sunset' }),
    ).not.toBeInTheDocument();
    expect(within(promoter).getByText('Beach Sunset')).toBeInTheDocument();
  });

  it('cambiar de pestaña no mueve la página: los dos paneles quedan armados y solo se ve el activo', () => {
    render(<LandingDemo />);

    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('Organizador');

    fireEvent.click(screen.getByRole('tab', { name: 'RPP' }));

    expect(screen.getAllByRole('tabpanel', { hidden: true })).toHaveLength(2);
    expect(screen.getByRole('tabpanel')).toHaveAccessibleName('RPP');
  });

  it('es una vitrina: el panel se mira pero no se puede tocar', () => {
    render(<LandingDemo />);

    expect(
      screen.getByRole('tabpanel', { name: 'Organizador' }),
    ).toHaveAttribute('inert');
  });
});
