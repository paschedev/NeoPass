# NeoPass: frontend

Web de NeoPass: Next.js 16, React 19 y Tailwind 4. Las páginas son client components y la sesión (JWT) vive en `localStorage`. Se despliega en Vercel.

## Puesta en marcha

Necesita el backend corriendo (ver `backend/README.md`).

```bash
cd frontend
npm ci
cp .env.example .env.local
npm run dev   # http://localhost:3000
```

## Variables de entorno

Están en `.env.example`. Son públicas (Next.js las incluye en el código del navegador), así que nunca llevan secretos.

- `NEXT_PUBLIC_API_URL`: URL del backend.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: site key de Cloudflare Turnstile.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (opcional): clave de Google Maps Platform, restringida por dominio y a las APIs Maps JavaScript, Places (New) y Maps Embed. Sin ella la dirección del evento es un campo de texto y la página del evento no muestra el mapa (el botón "Cómo llegar" funciona igual).

## Scripts

- `npm run build`: build de producción (incluye el type-check).
- `npm run lint`: ESLint.
- `npm test`: Vitest + Testing Library en jsdom, con el backend simulado.

## Estructura

- `src/app/`: páginas (App Router).
- `src/components/`: componentes; los del panel del organizador, en `components/panel/`.
- `src/hooks/` y `src/utils/`: lógica compartida. Toda llamada al backend pasa por `apiFetch` (`utils/api.ts`).
