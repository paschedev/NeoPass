import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { getCityFromAddress, roundCoordinate, type MapLocation } from './maps';

// Borde con Google Maps: todo lo que habla con su API pasa por acá, y los
// tests lo simulan entero. La clave es pública (se restringe por dominio).

export type PlaceSuggestion = {
  id: string;
  mainText: string;
  secondaryText: string;
};

export type PickedPlace = MapLocation & {
  placeId: string;
  address: string;
  city: string | null;
};

export type LocationMap = {
  setCenter: (location: MapLocation) => void;
  // Si se puede mover el mapa para ajustar el punto.
  setAdjustable: (adjustable: boolean) => void;
  destroy: () => void;
};

export function getMapsApiKey(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
}

// Sin clave (por ejemplo en local) la dirección es un campo de texto común.
export function isMapsEnabled(): boolean {
  return getMapsApiKey() !== '';
}

const LANGUAGE = 'es-419';
const REGION = 'AR';

let configured = false;

function configure() {
  if (configured) return;
  setOptions({
    key: getMapsApiKey(),
    v: 'weekly',
    language: LANGUAGE,
    region: REGION,
  });
  configured = true;
}

// Una búsqueda y la elección de un lugar se cobran como una sola sesión.
let session: google.maps.places.AutocompleteSessionToken | null = null;
let predictions = new Map<string, google.maps.places.PlacePrediction>();

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  configure();
  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    await importLibrary('places');
  session ??= new AutocompleteSessionToken();
  const { suggestions } =
    await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken: session,
      includedRegionCodes: [REGION.toLowerCase()],
      language: LANGUAGE,
      region: REGION.toLowerCase(),
    });

  predictions = new Map();
  return suggestions.flatMap(({ placePrediction }) => {
    if (!placePrediction) return [];
    predictions.set(placePrediction.placeId, placePrediction);
    return [
      {
        id: placePrediction.placeId,
        mainText: placePrediction.mainText?.text ?? placePrediction.text.text,
        secondaryText: placePrediction.secondaryText?.text ?? '',
      },
    ];
  });
}

// Dirección, ciudad y punto de un lugar sugerido por la última búsqueda.
export async function fetchPlace(id: string): Promise<PickedPlace | null> {
  const prediction = predictions.get(id);
  if (!prediction) return null;
  const place = prediction.toPlace();
  // Solo campos del nivel básico de Place Details.
  await place.fetchFields({
    fields: ['location', 'formattedAddress', 'addressComponents'],
  });
  session = null;
  if (!place.location) return null;
  return {
    placeId: prediction.placeId,
    address: place.formattedAddress ?? prediction.text.text,
    city: getCityFromAddress(place.addressComponents ?? []),
    latitude: roundCoordinate(place.location.lat()),
    longitude: roundCoordinate(place.location.lng()),
  };
}

const toLatLng = ({ latitude, longitude }: MapLocation) => ({
  lat: latitude,
  lng: longitude,
});

const samePoint = (a: MapLocation, b: MapLocation) =>
  a.latitude === b.latitude && a.longitude === b.longitude;

const gestures = (adjustable: boolean) => ({
  gestureHandling: adjustable ? 'greedy' : 'none',
  zoomControl: adjustable,
});

// Mapa del punto del evento: el punto es siempre el centro. Si es ajustable,
// se mueve el mapa por debajo y `onMove` avisa cuando se deja de mover.
export async function mountLocationMap(
  element: HTMLElement,
  center: MapLocation,
  {
    adjustable,
    onMove,
  }: { adjustable: boolean; onMove: (location: MapLocation) => void },
): Promise<LocationMap> {
  configure();
  const { Map } = await importLibrary('maps');
  const map = new Map(element, {
    center: toLatLng(center),
    zoom: 17,
    disableDefaultUI: true,
    clickableIcons: false,
    keyboardShortcuts: false,
    ...gestures(adjustable),
  });

  let current = center;
  const listener = map.addListener('idle', () => {
    const mapCenter = map.getCenter();
    if (!mapCenter) return;
    const moved = {
      latitude: roundCoordinate(mapCenter.lat()),
      longitude: roundCoordinate(mapCenter.lng()),
    };
    if (samePoint(moved, current)) return;
    current = moved;
    onMove(moved);
  });

  return {
    setCenter(location) {
      if (samePoint(location, current)) return;
      current = location;
      map.setCenter(toLatLng(location));
    },
    setAdjustable(adjustable) {
      map.setOptions(gestures(adjustable));
    },
    destroy() {
      listener.remove();
    },
  };
}
