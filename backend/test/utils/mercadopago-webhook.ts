import { createHmac } from 'node:crypto';
import { testEnv } from '../setup/test-env';

// Header x-signature como lo arma Mercado Pago para una notificación.
export function signWebhook(
  dataId: string,
  requestId: string,
  secret = testEnv.MERCADOPAGO_WEBHOOK_SECRET,
) {
  const ts = '1742505638683';
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const hash = createHmac('sha256', secret).update(manifest).digest('hex');
  return `ts=${ts},v1=${hash}`;
}
