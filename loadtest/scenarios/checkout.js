// Compras: cada iteración es una persona que aprieta "Comprar". Parámetros:
// RATE (compras/s), DURATION, TYPES (números de las entradas, separados por
// coma; se reparten en orden), QUANTITY (entradas por compra), BUYERS y
// BUYER_OFFSET (qué compradores usar).
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { loadId } from '../lib/ids.js';
import {
  arrivals,
  asClient,
  BASE,
  countResponse,
  numberParam,
  param,
  runData,
  SUMMARY_OPTIONS,
  writeSummary,
} from './common.js';

const TYPES = param('TYPES', '1').split(',').map(Number);
const QUANTITY = numberParam('QUANTITY', 1);
const BUYER_OFFSET = numberParam('BUYER_OFFSET', 0);
const buyers = runData('buyers');

export const options = {
  ...SUMMARY_OPTIONS,
  discardResponseBodies: true,
  scenarios: {
    checkout: arrivals({
      rate: numberParam('RATE', 10),
      duration: param('DURATION', '60s'),
    }),
  },
};

const checkout = new Trend('checkout_ms', true);

export default function () {
  const n = exec.scenario.iterationInTest;
  const buyer = (BUYER_OFFSET + n) % buyers.length;
  const ticketType = loadId('ticketType', TYPES[n % TYPES.length]);
  const res = http.post(
    `${BASE}/orders/checkout`,
    JSON.stringify({
      captchaToken: 'carga',
      items: [{ ticketTypeId: ticketType, quantity: QUANTITY }],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${buyers[buyer]}`,
        ...asClient(`comprador-${buyer + 1}`),
      },
      tags: { name: 'checkout' },
      timeout: '30s',
    },
  );
  checkout.add(res.timings.duration);
  countResponse(res);
}

export function handleSummary(data) {
  return writeSummary(data);
}
