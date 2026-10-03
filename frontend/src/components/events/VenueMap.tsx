import { Navigation } from 'lucide-react';
import { getMapsApiKey } from '@/utils/google-maps';
import { getDirectionsUrl, getEmbedMapUrl, hasMapLocation } from '@/utils/maps';

// Mapa del lugar en la página del evento, con el botón para abrirlo en Google
// Maps. Los eventos sin ubicación en el mapa no muestran nada.
export default function VenueMap({
  latitude,
  longitude,
  venuePlaceId,
  venueName,
  venueAddress,
}: {
  latitude?: number | null;
  longitude?: number | null;
  venuePlaceId?: string | null;
  venueName?: string | null;
  venueAddress?: string | null;
}) {
  const location = { latitude, longitude, venuePlaceId, venueAddress };
  if (!hasMapLocation(location)) return null;
  const apiKey = getMapsApiKey();

  return (
    <div className="rounded-2xl border border-white/5 overflow-hidden bg-white/5">
      {apiKey && (
        <iframe
          title={`Mapa de ${venueName || 'la ubicación del evento'}`}
          src={getEmbedMapUrl(location, apiKey)}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="w-full h-64 md:h-80 border-0 block"
        />
      )}
      <div className="p-4 flex justify-center md:justify-end">
        <a
          href={getDirectionsUrl(location)}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
        >
          <Navigation className="w-4 h-4" /> Cómo llegar
        </a>
      </div>
    </div>
  );
}
