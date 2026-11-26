import type { MetadataRoute } from 'next';
import { fetchPublicEventsPage } from './public-events';
import { SITE_URL, eventPath } from './site';

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

// Los eventos publicados que no terminaron (lo mismo que lista /eventos). Si
// la API falla, el mapa sale con lo que haya juntado: mejor eso que nada.
async function fetchPublicEventIds(revalidate: number): Promise<string[]> {
  const ids: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPublicEventsPage(page, PAGE_SIZE, revalidate);
    if (!result) break;
    ids.push(...result.items.map((event) => event.id));
    if (result.items.length === 0 || ids.length >= result.total) break;
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
