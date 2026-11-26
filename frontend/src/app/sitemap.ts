import { buildSitemap } from '@/utils/sitemap';

// El mapa del sitio para Google (/sitemap.xml). Se arma en cada pedido: como
// página guardada con revalidate, Vercel la siguió sirviendo igual que en el
// deploy. La lista de eventos sí se guarda, 10 minutos, para no pedírsela a
// la API cada vez que Google pasa.
export const revalidate = 0;

const EVENTS_REVALIDATE_SECONDS = 600;

export default function sitemap() {
  return buildSitemap(EVENTS_REVALIDATE_SECONDS);
}
