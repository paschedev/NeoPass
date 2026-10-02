import { describe, expect, it } from 'vitest';
import {
  getCityFromAddress,
  getDirectionsUrl,
  getEmbedMapUrl,
  hasMapLocation,
} from './maps';

const obelisco = { latitude: -34.6037389, longitude: -58.3815704 };
// El mismo punto elegido de la lista de Google.
const obeliscoPlace = {
  ...obelisco,
  venuePlaceId: 'ChIJS4Xb0z_LvJURM1UCa7Y8t7k',
  venueAddress: 'Av. 9 de Julio s/n, Buenos Aires',
};

describe('hasMapLocation', () => {
  it('un evento tiene ubicación en el mapa solo con sus dos coordenadas', () => {
    expect(hasMapLocation(obelisco)).toBe(true);
    expect(hasMapLocation({ latitude: 0, longitude: 0 })).toBe(true);
    expect(hasMapLocation({ latitude: null, longitude: null })).toBe(false);
    expect(hasMapLocation({ latitude: -34.6, longitude: null })).toBe(false);
    expect(hasMapLocation({})).toBe(false);
  });
});

describe('getDirectionsUrl', () => {
  it('con un lugar de Google abre su ficha, buscado por su dirección y no por coordenadas', () => {
    const url = new URL(getDirectionsUrl(obeliscoPlace));

    expect(url.origin + url.pathname).toBe(
      'https://www.google.com/maps/search/',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      api: '1',
      query: 'Av. 9 de Julio s/n, Buenos Aires',
      query_place_id: 'ChIJS4Xb0z_LvJURM1UCa7Y8t7k',
    });
  });

  it('un punto marcado a mano se abre por su coordenada', () => {
    expect(getDirectionsUrl({ ...obelisco, venuePlaceId: null })).toBe(
      'https://www.google.com/maps/search/?api=1&query=-34.6037389%2C-58.3815704',
    );
  });
});

describe('getEmbedMapUrl', () => {
  it('con un lugar de Google muestra su ficha', () => {
    const url = new URL(getEmbedMapUrl(obeliscoPlace, 'clave-publica'));

    expect(url.searchParams.get('q')).toBe(
      'place_id:ChIJS4Xb0z_LvJURM1UCa7Y8t7k',
    );
  });

  it('un punto marcado a mano se muestra por su coordenada, en español y para Argentina', () => {
    const url = new URL(getEmbedMapUrl(obelisco, 'clave-publica'));

    expect(url.origin + url.pathname).toBe(
      'https://www.google.com/maps/embed/v1/place',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'clave-publica',
      q: '-34.6037389,-58.3815704',
      zoom: '16',
      language: 'es-419',
      region: 'AR',
    });
  });
});

describe('getCityFromAddress', () => {
  const component = (longText: string, ...types: string[]) => ({
    longText,
    types,
  });

  it('usa la localidad', () => {
    expect(
      getCityFromAddress([
        component('1234', 'street_number'),
        component('Rosario', 'locality', 'political'),
        component('Santa Fe', 'administrative_area_level_1', 'political'),
      ]),
    ).toBe('Rosario');
  });

  it('sin localidad usa el partido o departamento, y si no la provincia', () => {
    expect(
      getCityFromAddress([
        component('Pilar', 'administrative_area_level_2', 'political'),
        component('Buenos Aires', 'administrative_area_level_1', 'political'),
      ]),
    ).toBe('Pilar');
    expect(
      getCityFromAddress([
        component(
          'Cdad. Autónoma de Buenos Aires',
          'administrative_area_level_1',
          'political',
        ),
      ]),
    ).toBe('Cdad. Autónoma de Buenos Aires');
  });

  it('sin datos de la zona no hay ciudad', () => {
    expect(getCityFromAddress([component('Argentina', 'country')])).toBeNull();
    expect(getCityFromAddress([])).toBeNull();
  });
});
