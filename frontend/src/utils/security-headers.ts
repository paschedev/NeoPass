// Cabeceras de seguridad de todas las páginas (las usa next.config.ts).
//
// La política de contenido (CSP) va en modo "solo reporte": el navegador
// anota en la consola lo que bloquearía, sin bloquear nada. Cuando las
// pantallas no muestren avisos, se pasa a Content-Security-Policy.

const GOOGLE_SIGN_IN = 'https://accounts.google.com';
const GOOGLE_MAPS = [
  'https://maps.googleapis.com',
  'https://maps.gstatic.com',
];
const TURNSTILE = 'https://challenges.cloudflare.com';
// El lector de QR baja su motor (WebAssembly) de acá cuando el navegador no
// trae lector propio (Safari en iPhone, Firefox).
const QR_READER = 'https://fastly.jsdelivr.net';

type Header = { key: string; value: string };

function apiOrigin(apiUrl: string | undefined): string | null {
  if (!apiUrl) return null;
  try {
    return new URL(apiUrl).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({
  apiUrl,
  development = false,
}: {
  apiUrl?: string;
  development?: boolean;
}): string {
  const api = apiOrigin(apiUrl);
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // Next.js mete scripts en línea en cada página.
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      "'wasm-unsafe-eval'",
      ...(development ? ["'unsafe-eval'"] : []),
      GOOGLE_SIGN_IN,
      ...GOOGLE_MAPS,
      TURNSTILE,
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'",
      GOOGLE_SIGN_IN,
      'https://fonts.googleapis.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'blob:',
      'https://res.cloudinary.com',
      'https://*.googleapis.com',
      'https://*.gstatic.com',
      'https://*.google.com',
      'https://*.googleusercontent.com',
      'https://flagcdn.com',
      'https://i.ytimg.com',
    ],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'connect-src': [
      "'self'",
      ...(api ? [api] : []),
      ...(development ? ['ws://localhost:*'] : []),
      'https://api.cloudinary.com',
      GOOGLE_SIGN_IN,
      'https://*.googleapis.com',
      'https://*.gstatic.com',
      QR_READER,
    ],
    'frame-src': [
      GOOGLE_SIGN_IN,
      'https://www.google.com',
      TURNSTILE,
      'https://www.youtube-nocookie.com',
      'https://www.youtube.com',
    ],
    'worker-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

export function securityHeaders(options: {
  apiUrl?: string;
  development?: boolean;
}): Header[] {
  return [
    {
      key: 'Content-Security-Policy-Report-Only',
      value: contentSecurityPolicy(options),
    },
    // Nadie puede mostrar NeoPass dentro de un iframe (clickjacking).
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // La de siempre de los navegadores, fija: Google Maps reconoce la
    // clave por el origen que viaja acá.
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // La cámara solo para el escáner de NeoPass; nada de micrófono ni
    // ubicación.
    {
      key: 'Permissions-Policy',
      value: 'camera=(self), microphone=(), geolocation=()',
    },
  ];
}
