import type { Metadata } from 'next';
import { cache } from 'react';
import { SHARE_IMAGE_SIZE, shareImageUrl } from './cloudinary';
import { EVENT_TIME_ZONE, formatWeekdayDateTime } from './format';
import { eventPath, serverApiUrl } from './site';

// Lo que usan la vista previa y la ficha para Google de GET /events/:id.
export type PublicEvent = {
  title: string;
  description?: string | null;
  imageUrl: string | null;
  startDate: string;
  endDate?: string;
  venueName: string;
  venueAddress?: string | null;
  venueCity?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  organizerName?: string | null;
  buyerFeePercentage?: string | number;
  ticketBatches?: {
    name: string;
    publishAt: string | null;
    saleStatus: 'UPCOMING' | 'ON_SALE' | 'SOLD_OUT';
    ticketTypes: {
      name: string;
      price: string | number;
      available: number;
    }[];
  }[];
};

const API_TIMEOUT_MS = 3000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La de app/opengraph-image.tsx. Un evento sin flyer la tiene que pedir:
// su openGraph reemplaza entero al de la raíz, imagen incluida.
const GENERAL_IMAGE = {
  url: '/opengraph-image',
  ...SHARE_IMAGE_SIZE,
  alt: 'NeoPass',
};

function buildEventMetadata(event: PublicEvent, id: string): Metadata {
  const description = `${formatWeekdayDateTime(event.startDate, EVENT_TIME_ZONE)} hs · ${event.venueName}`;
  const image = event.imageUrl
    ? {
        url: shareImageUrl(event.imageUrl),
        ...SHARE_IMAGE_SIZE,
        alt: event.title,
      }
    : GENERAL_IMAGE;
  return {
    title: { absolute: `${event.title} · NeoPass` },
    description,
    // Cada RRPP comparte el evento con su ?rpp=: para Google son todos la
    // misma página, la que no lo lleva.
    alternates: { canonical: eventPath(id) },
    openGraph: { title: event.title, description, images: [image] },
  };
}

// El evento publicado; "missing" si la API dice que no existe o no es público
// (borrador, terminado, cancelado) o si el id no es válido; "unavailable" si
// la API falló o tardó, y entonces no se sabe. Una sola consulta por página:
// la comparten la página, los metadatos y la ficha para Google.
export type PublicEventResult =
  | { kind: 'found'; event: PublicEvent }
  | { kind: 'missing' }
  | { kind: 'unavailable' };

export const fetchPublicEventResult = cache(
  async (id: string): Promise<PublicEventResult> => {
    if (!UUID.test(id)) return { kind: 'missing' };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    try {
      // Nunca con el ?rpp= del link: la API le sumaría la visita al RRPP.
      const res = await fetch(`${serverApiUrl()}/events/${id}`, {
        signal: controller.signal,
        next: { revalidate: 60 },
      });
      if (res.status === 404) return { kind: 'missing' };
      if (!res.ok) return { kind: 'unavailable' };
      return { kind: 'found', event: (await res.json()) as PublicEvent };
    } catch (error) {
      console.warn(`Event page without event data for ${id}`, error);
      return { kind: 'unavailable' };
    } finally {
      clearTimeout(timeout);
    }
  },
);

// El evento publicado, o null si no existe o la API no responde.
export async function fetchPublicEvent(
  id: string,
): Promise<PublicEvent | null> {
  const result = await fetchPublicEventResult(id);
  return result.kind === 'found' ? result.event : null;
}

// La vista previa de un evento al compartir su link (WhatsApp, Instagram,
// X). Si no se puede armar, devuelve {} y queda la general de NeoPass.
export async function fetchEventMetadata(id: string): Promise<Metadata> {
  const event = await fetchPublicEvent(id);
  return event ? buildEventMetadata(event, id) : {};
}
