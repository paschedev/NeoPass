import { createHmac, timingSafeEqual } from 'node:crypto';

interface WebhookSignatureInput {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  secret: string;
}

// Same algorithm as the official SDK validator (mercadopago/sdk-nodejs,
// src/utils/webhook): HMAC-SHA256 with the app's secret over
// "id:<data.id>;request-id:<x-request-id>;ts:<ts>;", compared in constant time.
export function isValidWebhookSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: WebhookSignatureInput): boolean {
  if (!xSignature) return false;

  const parts = new Map(
    xSignature.split(',').map((part) => {
      const [key, ...value] = part.split('=');
      return [key.trim().toLowerCase(), value.join('=').trim()];
    }),
  );
  const ts = parts.get('ts');
  const received = parts.get('v1');
  if (!ts || !/^\d+$/.test(ts) || !received) return false;

  const manifest = [
    dataId && `id:${dataId}`,
    xRequestId && `request-id:${xRequestId}`,
    `ts:${ts}`,
  ]
    .filter(Boolean)
    .join(';');
  const expected = createHmac('sha256', secret)
    .update(`${manifest};`)
    .digest('hex');

  return (
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  );
}
