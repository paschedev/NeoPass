import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/utils/site';

// Sin "Disallow": las páginas privadas responden "no indexar"
// (next.config.ts) y Google tiene que poder entrar a leerlo para sacarlas.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
