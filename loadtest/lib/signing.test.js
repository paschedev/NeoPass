import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import { isValidWebhookSignature } from '../../backend/src/payments/webhook-signature.ts';
import { loadId } from './ids.js';
import { buyerTokens, signedPaymentNotice } from './signing.js';

// La verificación del backend: misma librería que usa @nestjs/jwt.
const require = createRequire(new URL('../../backend/package.json', import.meta.url));
const jwt = require('jsonwebtoken');

const SECRET = 'secreto-de-carga';

describe('firmas del generador', () => {
  it('el backend acepta las sesiones de los compradores de carga', () => {
    const [token] = buyerTokens(SECRET, 1);

    const payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });

    assert.equal(payload.sub, loadId('buyer', 1));
    assert.ok(payload.exp > payload.iat);
  });

  it('el backend acepta la firma de un aviso de pago', () => {
    const orderId = loadId('buyer', 7);
    const { requestId, signature } = signedPaymentNotice(SECRET, orderId);

    assert.equal(
      isValidWebhookSignature({
        xSignature: signature,
        xRequestId: requestId,
        dataId: orderId,
        secret: SECRET,
      }),
      true,
    );
  });

  it('con otro secreto la firma no vale', () => {
    const { requestId, signature } = signedPaymentNotice('otro', 'orden-1');

    assert.equal(
      isValidWebhookSignature({
        xSignature: signature,
        xRequestId: requestId,
        dataId: 'orden-1',
        secret: SECRET,
      }),
      false,
    );
  });
});
