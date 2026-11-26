import type { MetadataRoute } from 'next';
import { SITE_URL, eventPath, serverApiUrl } from './site';

// Las páginas públicas que tienen que estar en Google. El panel, el checkout
// y el ingreso no van: no le sirven a quien busca.
const PUBLIC_PAGES = [
  '/',
  '/eventos',
  '/terminos',
  '/terminos/organizadores',
  '/privacidad',
];

// El máximo por página que acepta GET /events, y un tope de vueltas por si
// la API respondiera siempre lo mismo.
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
const API_TIMEOUT_MS = 5000;

type EventsPage = { items: { id: string }[]; total: number };

// Los eventos publicados que no terminaron (lo mismo que lista /eventos). Si
// la API falla, el mapa sale con lo que haya juntado: mejor eso que nada.
async function fetchPublicEventIds(revalidate: number): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const res = await fetch(
        `${serverApiUrl()}/events?page=${page}&limit=${PAGE_SIZE}`,
        {
          signal: AbortSignal.timeout(API_TIMEOUT_MS),
          next: { revalidate },
        },
      );
      if (!res.ok) break;
      const { items, total } = (await res.json()) as EventsPage;
      ids.push(...items.map((event) => event.id));
      if (items.length === 0 || ids.length >= total) break;
    } catch (error) {
      console.warn('Sitemap without the events of page', page, error);
      break;
    }
  }
  return ids;
}

export async function buildSitemap(
  revalidate: number,
): Promise<MetadataRoute.Sitemap> {
  const eventIds = await fetchPublicEventIds(revalidate);
  return [
    ...PUBLIC_PAGES.map((path) => ({ url: `${SITE_URL}${path}` })),
    ...eventIds.map((id) => ({ url: `${SITE_URL}${eventPath(id)}` })),
  ];
}
