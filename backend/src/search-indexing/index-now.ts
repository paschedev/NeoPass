// IndexNow: le avisa a Bing (y a los demás buscadores del protocolo) que una
// página cambió, para que la vuelva a leer en minutos y no cuando le toque.
// ChatGPT busca en el índice de Bing. https://www.indexnow.org
//
// La clave no es secreta: el protocolo la publica en el propio sitio
// (frontend/public/<clave>.txt) para probar que el aviso viene del dueño.
export const INDEXNOW_KEY = 'ebe64a3ffd5bb745a4b42b318079f8fe';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

// El sitio público. Solo se avisa desde producción: en local o en pruebas
// FRONTEND_URL es otra dirección y no hay nada que indexar.
const PUBLIC_SITE = 'https://neopass.ar';
const PUBLIC_HOSTS = new Set(['neopass.ar', 'www.neopass.ar']);

export function isPublicSite(frontendUrl: string): boolean {
  try {
    return PUBLIC_HOSTS.has(new URL(frontendUrl).hostname);
  } catch {
    return false;
  }
}

export const eventUrl = (eventId: string) =>
  `${PUBLIC_SITE}/eventos/${eventId}`;

export function indexNowBody(urls: string[]) {
  return {
    host: new URL(PUBLIC_SITE).hostname,
    key: INDEXNOW_KEY,
    keyLocation: `${PUBLIC_SITE}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  };
}
