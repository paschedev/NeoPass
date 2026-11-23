# Servicio de la prueba de carga: Mercado Pago y Resend simulados más k6.
# Solo para el entorno de prueba de Railway (servicio con raíz en loadtest/).
FROM grafana/k6:2.3.0 AS k6

FROM node:24.11.1-alpine3.23
COPY --from=k6 /usr/bin/k6 /usr/bin/k6
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY scenarios ./scenarios
USER node
CMD ["node", "server.js"]
