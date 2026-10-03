import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { getMapsApiKey } from '@/utils/google-maps';
import VenueMap from './VenueMap';

vi.mock('@/utils/google-maps', () => ({ getMapsApiKey: vi.fn() }));

const OBELISCO = { latitude: -34.6037389, longitude: -58.3815704 };

describe('VenueMap', () => {
  afterEach(() => vi.clearAllMocks());

  it('con ubicación muestra el mapa del lugar y el botón para abrirlo en Google Maps', () => {
    vi.mocked(getMapsApiKey).mockReturnValue('clave-publica');

    render(<VenueMap {...OBELISCO} venueName="Club Central" />);

    const map = screen.getByTitle('Mapa de Club Central');
    expect(map).toHaveAttribute(
      'src',
      expect.stringContaining('q=-34.6037389%2C-58.3815704'),
    );
    expect(map).toHaveAttribute('loading', 'lazy');
    const link = screen.getByRole('link', { name: /cómo llegar/i });
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=-34.6037389%2C-58.3815704',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('con un lugar de Google, el mapa y el botón muestran ese lugar', () => {
    vi.mocked(getMapsApiKey).mockReturnValue('clave-publica');

    render(
      <VenueMap
        {...OBELISCO}
        venuePlaceId="ChIJ-obelisco"
        venueAddress="Av. 9 de Julio s/n"
        venueName="Club Central"
      />,
    );

    expect(screen.getByTitle('Mapa de Club Central')).toHaveAttribute(
      'src',
      expect.stringContaining('q=place_id%3AChIJ-obelisco'),
    );
    expect(screen.getByRole('link', { name: /cómo llegar/i })).toHaveAttribute(
      'href',
      expect.stringContaining('query_place_id=ChIJ-obelisco'),
    );
  });

  it('sin la clave de Google no muestra el mapa, pero sí el botón', () => {
    vi.mocked(getMapsApiKey).mockReturnValue('');

    render(<VenueMap {...OBELISCO} venueName="Club Central" />);

    expect(screen.queryByTitle(/mapa de/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /cómo llegar/i }),
    ).toBeInTheDocument();
  });

  it('un evento sin ubicación no muestra mapa ni botón', () => {
    vi.mocked(getMapsApiKey).mockReturnValue('clave-publica');

    const { container } = render(
      <VenueMap latitude={null} longitude={null} venueName="Club Central" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
