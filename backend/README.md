# NeoPass: backend

API de NeoPass: NestJS 11, Prisma 6 + PostgreSQL, BullMQ + Redis. Pagos con Mercado Pago (OAuth marketplace), mails con Resend, imágenes con Cloudinary y captcha con Cloudflare Turnstile. Se despliega en Railway.

## Requisitos

- Node 22.
- Docker, para Postgres y Redis (`docker-compose.yml` en la raíz del repo).

## Puesta en marcha

```bash
# Desde la raíz del repo: Postgres en :5432 (DB neopass) y Redis en :6379
docker compose up -d

cd backend
npm ci
cp .env.example .env   # y completar los valores
npx prisma migrate deploy
npm run start:dev      # http://localhost:3001
```

## Variables de entorno

Están todas en `.env.example`. La app las valida al arrancar (`src/config/env.validation.ts`): si falta una o es inválida, no arranca y el error lista solo los nombres. `CAPTCHA_DISABLED=true` es solo para desarrollo local; en producción hace fallar el arranque.

## Tests y lint

- `npm test`: tests unitarios (Jest).
- `npm run test:e2e`: tests e2e con supertest contra el Postgres de test (`docker compose up -d db-test`, puerto 5433). Recrea la base `neopass_test` aplicando las migraciones y falla si `prisma/schema.prisma` tiene cambios sin migración. Mercado Pago, Resend, Turnstile y las colas están simulados.
- `npx eslint "{src,apps,libs,test}/**/*.ts"`: lint igual que la CI (`npm run lint` además corrige con `--fix`).
- `npm run build`: compila a `dist/`.

## Cambios de schema

1. Editar `prisma/schema.prisma`.
2. `npx prisma migrate dev --create-only --name <cambio>` contra la base local.
3. Revisar el SQL generado (los CHECK y los datos existentes se escriben a mano) y recién después aplicarla.

En producción las migraciones las aplica el pre-deploy de Railway (`npm run migrate:deploy`).

## Estructura

`src/` tiene un módulo por dominio (`auth`, `events`, `orders`, `payments`, `tickets`, `mail`, `notifications`, `presets`, `media`), cada uno con controller → service → repository. La configuración HTTP compartida con los tests está en `src/configure-app.ts`.
