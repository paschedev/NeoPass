import { buildSitemap } from '@/utils/sitemap';

// El mapa del sitio para Google (/sitemap.xml). Se arma de nuevo como mucho
// una vez por hora, así un evento nuevo aparece sin esperar un deploy.
export const revalidate = 3600;

export default function sitemap() {
  return buildSitemap(revalidate);
}
