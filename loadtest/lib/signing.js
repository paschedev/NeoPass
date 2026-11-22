import { createHmac, randomUUID } from 'node:crypto';
import { buyerEmail, loadId, scannerEmail } from './ids.js';

const DAY_S = 24 * 60 * 60;

// Sesión como la que firma el backend (AuthService): HS256 con JWT_SECRET.
export function signJwt(secret, { sub, email, role }) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ sub, email, role, iat: now, exp: now + DAY_S });
  const signature = createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function buyerTokens(secret, count) {
  return Array.from({ length: count }, (_, i) =>
    signJwt(secret, {
      sub: loadId('buyer', i + 1),
      email: buyerEmail(i + 1),
      role: 'CUSTOMER',
    }),
  );
}

export function scannerTokens(secret, count) {
  return Array.from({ length: count }, (_, i) =>
    signJwt(secret, {
      sub: loadId('scanner', i + 1),
      email: scannerEmail(i + 1),
      role: 'CUSTOMER',
    }),
  );
}

// Aviso de pago como los de Mercado Pago (backend: webhook-signature.ts).
export function signedPaymentNotice(secret, paymentId) {
  const ts = String(Date.now());
  const requestId = randomUUID();
  const v1 = createHmac('sha256', secret)
    .update(`id:${paymentId};request-id:${requestId};ts:${ts};`)
    .digest('hex');
  return { requestId, signature: `ts=${ts},v1=${v1}` };
}
