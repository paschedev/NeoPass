import type { Metadata } from 'next';
import { SHARE_IMAGE_SIZE, shareImageUrl } from './cloudinary';
import { formatWeekdayDateTime } from './format';

// Lo que usa la vista previa de GET /events/:id.
type SharedEvent = {
  name: string;
  imageUrl: string | null;
  startDate: string;
  venueName: string;
};

const EVENT_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const API_TIMEOUT_MS = 3000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// La de app/opengraph-image.tsx. Un evento sin flyer la tiene que pedir:
// su openGraph reemplaza entero al de la raíz, imagen incluida.
const GENERAL_IMAGE = {
  url: '/opengraph-image',
  ...SHARE_IMAGE_SIZE,
  alt: 'NeoPass',
};

function buildEventMetadata(event: SharedEvent): Metadata {
  const description = `${formatWeekdayDateTime(event.startDate, EVENT_TIME_ZONE)} hs · ${event.venueName}`;
  const image = event.imageUrl
    ? {
        url: shareImageUrl(event.imageUrl),
        ...SHARE_IMAGE_SIZE,
        alt: event.name,
      }
    : GENERAL_IMAGE;
  return {
    title: { absolute: `${event.name} · NeoPass` },
    description,
    openGraph: { title: event.name, description, images: [image] },
  };
}

// La vista previa de un evento al compartir su link (WhatsApp, Instagram,
// X). Si no se puede armar, devuelve {} y queda la general de NeoPass.
export async function fetchEventMetadata(id: string): Promise<Metadata> {
  if (!UUID.test(id)) return {};

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    // Nunca con el ?rpp= del link: la API le sumaría la visita al RPP.
    const res = await fetch(`${apiUrl}/events/${id}`, {
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return buildEventMetadata((await res.json()) as SharedEvent);
  } catch (error) {
    console.warn(`Share preview without event data for ${id}`, error);
    return {};
  } finally {
    clearTimeout(timeout);
  }
}
