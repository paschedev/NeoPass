// Pagos: avisos de Mercado Pago de las órdenes pendientes que creó el
// escenario de compras (el servicio los firma). Parámetros: RATE (avisos/s),
// COUNT (cuántos) y MP_SENDERS (desde cuántas IPs los manda Mercado Pago;
// 0 = todos desde la IP del generador, sin el encabezado de prueba).
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import {
  arrivals,
  asClient,
  BASE,
  countResponse,
  numberParam,
  runData,
  SUMMARY_OPTIONS,
  writeSummary,
} from './common.js';

const notices = runData('notices');
const RATE = numberParam('RATE', 100);
const MP_SENDERS = numberParam('MP_SENDERS', 20);

export const options = {
  ...SUMMARY_OPTIONS,
  discardResponseBodies: true,
  scenarios: {
    payments: arrivals({
      rate: RATE,
      duration: `${Math.max(1, Math.ceil(notices.length / RATE))}s`,
    }),
  },
};

const notice = new Trend('notice_ms', true);

export default function () {
  const n = exec.scenario.iterationInTest;
  if (n >= notices.length) return;
  const { orderId, mpUserId, requestId, signature } = notices[n];
  const res = http.post(
    `${BASE}/payments/webhook?data.id=${orderId}&type=payment`,
    JSON.stringify({
      action: 'payment.updated',
      type: 'payment',
      user_id: mpUserId,
      data: { id: orderId },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-signature': signature,
        'x-request-id': requestId,
        ...(MP_SENDERS > 0 ? asClient(`mercadopago-${n % MP_SENDERS}`) : {}),
      },
      tags: { name: 'notice' },
      timeout: '30s',
    },
  );
  notice.add(res.timings.duration);
  countResponse(res);
}

export function handleSummary(data) {
  return writeSummary(data);
}
