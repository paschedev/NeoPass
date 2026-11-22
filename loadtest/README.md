# Prueba de carga

Mide cuánto aguanta NeoPass en un pico de ventas, contra una copia de la infraestructura real: un entorno de prueba de Railway con su propia rama de Neon. **Nunca contra producción.** No se mandan mails reales ni se cobran pagos reales.

## Piezas

- **Backend de prueba**: el mismo código que producción, con tres variables que solo existen fuera de producción (si aparecen con `NODE_ENV=production` o en el entorno `production` de Railway, la app no arranca):
  - `MERCADOPAGO_API_URL`: Mercado Pago apunta al simulado.
  - `RESEND_BASE_URL`: Resend apunta al simulado.
  - `LOAD_TEST_CLIENT_HEADER`: el límite de pedidos por IP cuenta por ese encabezado, para que un solo generador sea miles de compradores distintos.
  - Además, `CAPTCHA_DISABLED=true`.
- **Servicio de carga** (esta carpeta, con su `Dockerfile`):
  - Mercado Pago simulado: guarda cada preferencia y devuelve el pago aprobado por el total de la orden.
  - Resend simulado con los límites del plan elegido: Free (100 por día, 3.000 por mes) o Pro (sin tope diario); los dos con 10 pedidos por segundo.
  - k6 2.3.0 y los escenarios de `scenarios/`, que se disparan por HTTP con un token y solo pueden apuntar al backend de prueba.
  - Mide la ida y vuelta a Redis, Turnstile y Mercado Pago desde la misma región.
- `seed.js`: carga datos sintéticos (organizadores, 40 eventos, 3.000 compradores, una puerta con 30.000 entradas). Se niega a escribir si la base tiene usuarios que no son de carga.
- `run.js`: dispara escenarios desde cualquier PC y guarda un resumen fuera del repo.

## Variables del servicio de carga

| Variable | Valor |
|---|---|
| `LOADTEST_TOKEN` | aleatorio, 32 caracteres o más |
| `BACKEND_URL` | `https://${{backend.RAILWAY_PUBLIC_DOMAIN}}` |
| `JWT_SECRET`, `MERCADOPAGO_WEBHOOK_SECRET`, `RESEND_API_KEY`, `LOAD_TEST_CLIENT_HEADER` | referencias a las del backend de prueba |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |

## Escenarios

| Escenario | Qué hace | Parámetros |
|---|---|---|
| `navigation` | listado y página de eventos (1 a 3) | `RATE`, `DURATION`, `VISITORS` |
| `checkout` | personas apretando "Comprar" | `RATE`, `DURATION`, `TYPES`, `QUANTITY`, `BUYERS`, `BUYER_OFFSET` |
| `payments` | avisos de pago de Mercado Pago de las órdenes pendientes | `RATE`, `COUNT`, `MP_SENDERS` |
| `checkin` | lecturas de QR en la puerta | `SCANNERS`, `RATE`, `DURATION`, `TICKET_OFFSET` |

Todos usan llegadas fijas por segundo: si el backend se frena, k6 no baja el ritmo, y la demora medida es la que vería la gente.

## Uso (Git Bash, desde la raíz del repo)

```bash
# Datos (conexión directa a la base de prueba, nunca la de producción)
DATABASE_URL='…' MERCADOPAGO_TOKEN_KEY='…' node loadtest/seed.js

# Una corrida, o varias seguidas con --steps
LOADTEST_URL=https://<servicio de carga> LOADTEST_TOKEN=… \
  node loadtest/run.js navigation DURATION=60s --steps RATE=50,100,200

# Configurar los simulados (plan de Resend, demoras supuestas de MP y Resend)
curl -X POST "$LOADTEST_URL/_control/config" -H "Authorization: Bearer $LOADTEST_TOKEN" \
  -H 'Content-Type: application/json' -d '{"resendPlan":"free","resendSentToday":3}'
```

Otras rutas de control: `GET /_control/stats`, `POST /_control/reset`, `GET /_control/records/emails|payments`, `GET /_control/probe/redis|turnstile|mercadopago`.

Tests de las piezas propias: `npm --prefix loadtest test`.

## Al terminar

Borrar el entorno de prueba de Railway y la rama de Neon: no quedan datos ni costos.
