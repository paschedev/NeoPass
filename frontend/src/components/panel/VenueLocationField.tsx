'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { EventFormInput } from '@/utils/event-form';
import {
  fetchPlace,
  isMapsEnabled,
  mountLocationMap,
  searchPlaces,
  type LocationMap,
  type PlaceSuggestion,
} from '@/utils/google-maps';
import { hasMapLocation, type MapLocation } from '@/utils/maps';
import toast from '@/utils/toast';

const SEARCH_DELAY_MS = 300;
const MIN_SEARCH_LENGTH = 3;
const PLACE_ERROR = 'No pudimos ubicar ese lugar en el mapa';

// Mapa con el punto fijo en el centro: se ajusta moviendo el mapa por debajo.
function LocationMapPicker({
  location,
  onMove,
}: {
  location: MapLocation;
  onMove: (location: MapLocation) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LocationMap | null>(null);
  const initial = useRef({ location, onMove });

  useEffect(() => {
    if (!container.current) return;
    let unmounted = false;
    mountLocationMap(
      container.current,
      initial.current.location,
      initial.current.onMove,
    )
      .then((mounted) => {
        if (unmounted) mounted.destroy();
        else map.current = mounted;
      })
      .catch((error) => console.error(error));
    return () => {
      unmounted = true;
      map.current?.destroy();
      map.current = null;
    };
  }, []);

  const { latitude, longitude } = location;
  useEffect(() => {
    map.current?.setCenter({ latitude, longitude });
  }, [latitude, longitude]);

  return (
    <div className="relative h-56 bg-neutral-900">
      <div ref={container} className="absolute inset-0" />
      <MapPin
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full w-9 h-9 text-red-500 fill-red-500/30 drop-shadow pointer-events-none"
      />
    </div>
  );
}

// Dirección del evento. Con Google Maps disponible busca lugares mientras se
// escribe; elegir uno guarda además el punto en el mapa y la ciudad. Es
// opcional: una dirección escrita a mano queda sin mapa.
export default function VenueLocationField({
  readOnly,
  className,
}: {
  // Con el evento en curso el lugar no se cambia.
  readOnly: boolean;
  className: string;
}) {
  const { register, setValue, getValues, control } =
    useFormContext<EventFormInput>();
  const [latitude, longitude, venueCity] = useWatch({
    control,
    name: ['latitude', 'longitude', 'venueCity'],
  });
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastSearch = useRef(0);

  const searchable = isMapsEnabled() && !readOnly;
  const location = { latitude, longitude };

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const search = (text: string) => {
    clearTimeout(searchTimer.current);
    const query = text.trim();
    const searchId = ++lastSearch.current;
    if (query.length < MIN_SEARCH_LENGTH) {
      setSuggestions([]);
      return;
    }
    searchTimer.current = setTimeout(() => {
      searchPlaces(query)
        // Una respuesta vieja no pisa a la de lo último que se escribió.
        .then((found) => {
          if (searchId === lastSearch.current) setSuggestions(found);
        })
        .catch((error) => {
          console.error(error);
          if (searchId === lastSearch.current) setSuggestions([]);
        });
    }, SEARCH_DELAY_MS);
  };

  const setLocation = (place: MapLocation, city?: string | null) => {
    setValue('latitude', place.latitude, { shouldDirty: true });
    setValue('longitude', place.longitude, { shouldDirty: true });
    if (city !== undefined) setValue('venueCity', city, { shouldDirty: true });
  };

  const pick = async (suggestion: PlaceSuggestion) => {
    lastSearch.current++;
    setSuggestions([]);
    try {
      const place = await fetchPlace(suggestion.id);
      if (!place) {
        toast.error(PLACE_ERROR);
        return;
      }
      setValue('venueAddress', place.address, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setLocation(place, place.city);
      if (!getValues('venueName').trim()) {
        setValue('venueName', suggestion.mainText, {
          shouldValidate: true,
          shouldDirty: true,
        });
      }
    } catch (error) {
      console.error(error);
      toast.error(PLACE_ERROR);
    }
  };

  const removeLocation = () => {
    setValue('latitude', null, { shouldDirty: true });
    setValue('longitude', null, { shouldDirty: true });
    setValue('venueCity', null, { shouldDirty: true });
  };

  const addressField = register('venueAddress');

  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setSuggestions([]);
        }
      }}
    >
      <div className="relative">
        <input
          id="venueAddress"
          type="text"
          readOnly={readOnly}
          autoComplete="off"
          placeholder={
            searchable
              ? 'Buscá la dirección o el nombre del lugar'
              : 'Ej: Av. Principal 1234, CABA'
          }
          className={className}
          {...addressField}
          onChange={(event) => {
            void addressField.onChange(event);
            if (searchable) search(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setSuggestions([]);
          }}
        />
        {suggestions.length > 0 && (
          <div className="absolute z-40 left-0 right-0 mt-2 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div
              role="listbox"
              aria-label="Lugares encontrados"
              className="max-h-64 overflow-y-auto overscroll-contain"
            >
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => void pick(suggestion)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors"
                >
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                  <span className="min-w-0">
                    <span className="block text-sm text-white truncate">
                      {suggestion.mainText}
                    </span>
                    <span className="block text-xs text-neutral-400 truncate">
                      {suggestion.secondaryText}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <p className="px-4 py-2 text-xs text-white text-right border-t border-white/10">
              Google Maps
            </p>
          </div>
        )}
      </div>

      {hasMapLocation(location) ? (
        <div className="mt-3 rounded-xl border border-white/10 overflow-hidden">
          {searchable && (
            <LocationMapPicker
              location={location}
              onMove={(moved) => setLocation(moved)}
            />
          )}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-neutral-300">
              {venueCity ? `Ciudad: ${venueCity}` : 'Ubicación marcada'}
              <span className="block text-xs text-neutral-500">
                {searchable
                  ? 'Mové el mapa para dejar el pin en el punto exacto.'
                  : 'La página del evento muestra este punto en el mapa.'}
              </span>
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={removeLocation}
                aria-label="Quitar ubicación del mapa"
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 text-xs font-medium text-neutral-200 hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </div>
        </div>
      ) : (
        searchable && (
          <p className="text-xs text-neutral-500 mt-1">
            Opcional: elegí un lugar de la lista para mostrar el mapa en la
            página del evento.
          </p>
        )
      )}
    </div>
  );
}
