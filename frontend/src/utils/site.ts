// La dirección pública de NeoPass. La usan las direcciones canónicas, el mapa
// del sitio y los datos para Google. www.neopass.ar redirige acá.
export const SITE_URL = 'https://neopass.ar';
export const SITE_NAME = 'NeoPass';
export const INSTAGRAM_URL = 'https://www.instagram.com/neopass.ar/';

// La página pública de un evento, sin el ?rpp= de los links de cada RRPP.
export const eventPath = (id: string) => `/eventos/${id}`;

// La API, para los pedidos que hace el servidor (metadatos y mapa del sitio).
export const serverApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
