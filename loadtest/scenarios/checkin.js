// Escáner: lecturas de entradas en la puerta del evento de carga. Parámetros:
// SCANNERS (teléfonos), RATE (lecturas/s entre todos), DURATION y
// TICKET_OFFSET (desde qué entrada leer; cada corrida usa entradas nuevas).
import http from 'k6/http';
import exec from 'k6/execution';
import { Counter, Trend } from 'k6/metrics';
import { qrCode } from '../lib/ids.js';
import {
  arrivals,
  BASE,
  countResponse,
  numberParam,
  param,
  runData,
  SUMMARY_OPTIONS,
  writeSummary,
} from './common.js';

const scanners = runData('scanners');
const TICKET_OFFSET = numberParam('TICKET_OFFSET', 0);

export const options = {
  ...SUMMARY_OPTIONS,
  scenarios: {
    checkin: arrivals({
      rate: numberParam('RATE', 50),
      duration: param('DURATION', '60s'),
    }),
  },
};

const scan = new Trend('checkin_ms', true);
const valid = new Counter('checkin_valid');
const notValid = new Counter('checkin_not_valid');

export default function () {
  const n = exec.scenario.iterationInTest;
  const res = http.post(
    `${BASE}/tickets/check-in`,
    JSON.stringify({ qrCode: qrCode(TICKET_OFFSET + n + 1) }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${scanners[n % scanners.length]}`,
      },
      tags: { name: 'checkin' },
      timeout: '15s',
    },
  );
  scan.add(res.timings.duration);
  countResponse(res);
  if (res.status === 201 || res.status === 200) {
    if (res.json('status') === 'VALID') valid.add(1);
    else notValid.add(1);
  }
}

export function handleSummary(data) {
  return writeSummary(data);
}
