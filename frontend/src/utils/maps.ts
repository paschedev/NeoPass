export type MapLocation = { latitude: number; longitude: number };

type MaybeLocated = { latitude?: number | null; longitude?: number | null };

// La ubicación en el mapa es opcional: un evento puede tener solo su dirección.
export function hasMapLocation<T extends MaybeLocated>(
  place: T,
): place is T & MapLocation {
  return place.latitude != null && place.longitude != null;
}

// ~1 cm: alcanza para un punto en el mapa y evita decimales de más.
export function roundCoordinate(value: number): number {
  return Math.round(value * 1e7) / 1e7;
}

const coordinates = ({ latitude, longitude }: MapLocation) =>
  `${latitude},${longitude}`;

// Abre Google Maps (app o web) en el punto del lugar. No necesita clave.
export function getDirectionsUrl(location: MapLocation): string {
  const params = new URLSearchParams({
    api: '1',
    query: coordinates(location),
  });
  return `https://www.google.com/maps/search/?${params}`;
}

// Mapa embebido (Maps Embed API) con un marcador en el punto del lugar.
export function getEmbedMapUrl(location: MapLocation, apiKey: string): string {
  const params = new URLSearchParams({
    key: apiKey,
    q: coordinates(location),
    zoom: '16',
    language: 'es-419',
    region: 'AR',
  });
  return `https://www.google.com/maps/embed/v1/place?${params}`;
}

const CITY_TYPES = [
  'locality',
  'administrative_area_level_2',
  'administrative_area_level_1',
];

// La ciudad de una dirección de Google: la localidad y, si no viene, el partido
// o departamento, o la provincia (CABA no tiene localidad).
export function getCityFromAddress(
  components: { longText: string | null; types: string[] }[],
): string | null {
  for (const type of CITY_TYPES) {
    const match = components.find(({ types }) => types.includes(type));
    if (match?.longText) return match.longText;
  }
  return null;
}
