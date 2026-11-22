// Navegación: listado de eventos y página de un evento, 1 listado cada 3
// detalles. Parámetros: RATE (pedidos/s), DURATION, VISITORS (personas
// distintas, para el límite por persona).
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend } from 'k6/metrics';
import { LAYOUT, loadId } from '../lib/ids.js';
import {
  arrivals,
  asClient,
  BASE,
  countResponse,
  numberParam,
  param,
  SUMMARY_OPTIONS,
  writeSummary,
} from './common.js';

const VISITORS = numberParam('VISITORS', 5000);

export const options = {
  ...SUMMARY_OPTIONS,
  discardResponseBodies: true,
  scenarios: {
    navigation: arrivals({
      rate: numberParam('RATE', 50),
      duration: param('DURATION', '60s'),
    }),
  },
};

const list = new Trend('list_ms', true);
const detail = new Trend('detail_ms', true);

export default function () {
  const n = exec.scenario.iterationInTest;
  const visitor = asClient(`visitante-${n % VISITORS}`);
  if (n % 4 === 0) {
    const res = http.get(`${BASE}/events?page=1&limit=24`, {
      headers: visitor,
      tags: { name: 'list' },
      timeout: '15s',
    });
    list.add(res.timings.duration);
    countResponse(res);
    return;
  }
  const event = loadId('event', 1 + (n % LAYOUT.events));
  const res = http.get(`${BASE}/events/${event}`, {
    headers: visitor,
    tags: { name: 'detail' },
    timeout: '15s',
  });
  detail.add(res.timings.duration);
  countResponse(res);
}

export function handleSummary(data) {
  return writeSummary(data);
}
