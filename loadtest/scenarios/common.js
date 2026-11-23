// Partes comunes de los escenarios de k6. El servicio de carga fija
// BACKEND_URL y LOAD_TEST_CLIENT_HEADER; el resto son parámetros de la corrida.
import { SharedArray } from 'k6/data';
import { Counter } from 'k6/metrics';

export const BASE = __ENV.BACKEND_URL;

export function param(name, fallback) {
  const value = __ENV[name];
  return value === undefined || value === '' ? fallback : value;
}

export function numberParam(name, fallback) {
  return Number(param(name, fallback));
}

// El backend de prueba cuenta el límite por este encabezado: cada valor es un
// comprador distinto, como si llegara desde su propia IP.
export function asClient(id) {
  return { [__ENV.LOAD_TEST_CLIENT_HEADER]: id };
}

// Lo que el servicio preparó para la corrida (sesiones, avisos firmados), en
// memoria compartida entre los usuarios virtuales.
export function runData(key) {
  return new SharedArray(key, () => JSON.parse(open(__ENV.DATA_PATH))[key]);
}

// Llegadas por segundo fijas (modelo abierto): si el backend se frena, k6 no
// baja el ritmo, así la demora medida es la que vería la gente.
export function arrivals({ rate, duration, maxVUs = 1500 }) {
  return {
    executor: 'constant-arrival-rate',
    rate,
    timeUnit: '1s',
    duration,
    preAllocatedVUs: Math.min(Math.max(rate, 20), 600),
    maxVUs,
  };
}

export const SUMMARY_OPTIONS = {
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
};

const responses = {
  ok: new Counter('responses_2xx'),
  conflict: new Counter('responses_409'),
  limited: new Counter('responses_429'),
  unavailable: new Counter('responses_503'),
  server: new Counter('responses_5xx_other'),
  other: new Counter('responses_other'),
  network: new Counter('responses_network_error'),
};

export function countResponse(res) {
  const { status } = res;
  if (status === 0) responses.network.add(1);
  else if (status >= 200 && status < 300) responses.ok.add(1);
  else if (status === 409) responses.conflict.add(1);
  else if (status === 429) responses.limited.add(1);
  else if (status === 503) responses.unavailable.add(1);
  else if (status >= 500) responses.server.add(1);
  else responses.other.add(1);
}

export function writeSummary(data) {
  return { [__ENV.SUMMARY_PATH]: JSON.stringify(data) };
}
