// Variables de los tests e2e. Solo valores de prueba: nunca poner secretos reales.
// La base es el servicio db-test de docker-compose.yml.
// Definir acá todo lo que lee la app: @prisma/client carga backend/.env al
// importarse y cualquier variable que falte acá se colaría desde ese archivo.
const TEST_DATABASE_URL =
  'postgresql://user:password@localhost:5433/neopass_test';

export const testEnv = {
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'test-jwt-secret',
  FRONTEND_URL: 'https://app.neopass.test',
  BACKEND_URL: 'http://localhost:3001',
  // BullMQ nunca se conecta: las colas están simuladas en createTestApp().
  REDIS_URL: 'redis://localhost:6379',
  MERCADOPAGO_ACCESS_TOKEN: 'TEST-platform-access-token',
  MERCADOPAGO_CLIENT_ID: 'test-client-id',
  MERCADOPAGO_CLIENT_SECRET: 'test-client-secret',
  MERCADOPAGO_WEBHOOK_SECRET: 'test-webhook-secret',
  RESEND_API_KEY: 're_test_key',
  TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
  CAPTCHA_DISABLED: 'false',
  CLOUDINARY_URL: 'cloudinary://test_api_key:test_api_secret@test-cloud',
};
