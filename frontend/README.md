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

## Scripts

- `npm run build`: build de producción (incluye el type-check).
- `npm run lint`: ESLint.
- `npm test`: Vitest + Testing Library en jsdom, con el backend simulado.

## Estructura

- `src/app/`: páginas (App Router).
- `src/components/`: componentes; los del panel del organizador, en `components/panel/`.
- `src/hooks/` y `src/utils/`: lógica compartida. Toda llamada al backend pasa por `apiFetch` (`utils/api.ts`).
