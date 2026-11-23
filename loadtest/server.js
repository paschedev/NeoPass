// Servicio de la prueba de carga (entorno de prueba de Railway, nunca en
// producción). Hace tres cosas:
// 1. Mercado Pago simulado: el backend de prueba lo usa con MERCADOPAGO_API_URL.
// 2. Resend simulado, con los límites del plan elegido: RESEND_BASE_URL.
// 3. Control con token (/_control): configura los simulados, corre los
//    escenarios de k6 contra el backend de prueba y mide la ida y vuelta a
//    Redis, Turnstile y Mercado Pago desde la misma región.
import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { createMercadoPago, SELLER_TOKEN_PREFIX } from './lib/mercadopago.js';
import { measureHttp, measureRedis } from './lib/probes.js';
import { LAYOUT } from './lib/ids.js';
import { createResendLimits } from './lib/resend-limits.js';
import { createRunner } from './lib/runner.js';
import {
  buyerTokens,
  scannerTokens,
  signedPaymentNotice,
} from './lib/signing.js';

const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TOKEN = required('LOADTEST_TOKEN');
const RESEND_API_KEY = required('RESEND_API_KEY');
if (TOKEN.length < 32) fail('LOADTEST_TOKEN must have at least 32 characters');

const config = {
  resendPlan: 'pro',
  resendSentToday: 0,
  resendSentThisMonth: 0,
  // Demoras supuestas de los servicios reales (no se pueden medir sin
  // credenciales): se ajustan por /_control/config.
  resendLatencyMs: 150,
  mpPreferenceLatencyMs: 300,
  mpPaymentLatencyMs: 200,
};
let resendLimits = newResendLimits();
let emails = [];
const mercadoPago = createMercadoPago();
const JWT_SECRET = required('JWT_SECRET');
const WEBHOOK_SECRET = required('MERCADOPAGO_WEBHOOK_SECRET');
const runner = createRunner(
  {
    BACKEND_URL: required('BACKEND_URL'),
    LOAD_TEST_CLIENT_HEADER: required('LOAD_TEST_CLIENT_HEADER'),
  },
  prepareRunData,
);

// Lo que cada escenario lee de su archivo de datos.
function prepareRunData(scenario, params) {
  const count = (name, fallback, max) =>
    Math.min(Number(params[name]) || fallback, max);
  if (scenario === 'checkout') {
    return { buyers: buyerTokens(JWT_SECRET, count('BUYERS', LAYOUT.buyers, LAYOUT.buyers)) };
  }
  if (scenario === 'checkin') {
    return { scanners: scannerTokens(JWT_SECRET, count('SCANNERS', 10, LAYOUT.scanners)) };
  }
  if (scenario === 'payments') {
    const orders = mercadoPago.takeOrdersToPay(count('COUNT', 1000, 20_000));
    return {
      notices: orders.map(({ orderId, mpUserId }) => ({
        orderId,
        mpUserId,
        ...signedPaymentNotice(WEBHOOK_SECRET, orderId),
      })),
    };
  }
  return {};
}

function newResendLimits() {
  return createResendLimits({
    plan: config.resendPlan,
    sentToday: config.resendSentToday,
    sentThisMonth: config.resendSentThisMonth,
  });
}

const routes = [
  ['POST', /^\/checkout\/preferences\/?$/, sellerOnly(createPreference)],
  ['GET', /^\/v1\/payments\/([\w-]+)$/, sellerOnly(readPayment)],
  ['POST', /^\/oauth\/token$/, oauthToken],
  ['POST', /^\/emails$/, sendEmail],
  ['GET', /^\/health$/, () => ({ status: 200, body: { ok: true } })],
  ['GET', /^\/_control\/stats$/, control(stats)],
  ['POST', /^\/_control\/config$/, control(updateConfig)],
  ['POST', /^\/_control\/reset$/, control(reset)],
  ['GET', /^\/_control\/records\/(emails|payments)$/, control(records)],
  ['POST', /^\/_control\/runs$/, control(startRun)],
  ['GET', /^\/_control\/runs$/, control(() => ({ status: 200, body: runner.list() }))],
  ['GET', /^\/_control\/runs\/([\w-]+)$/, control(getRun)],
  ['GET', /^\/_control\/probe\/redis$/, control(probeRedis)],
  ['GET', /^\/_control\/probe\/(turnstile|mercadopago)$/, control(probeHttp)],
];

async function createPreference({ request, body }) {
  await delay(config.mpPreferenceLatencyMs);
  return mercadoPago.createPreference(bearer(request), body, Date.now());
}

async function readPayment({ match }) {
  await delay(config.mpPaymentLatencyMs);
  return mercadoPago.readPayment(match[1], Date.now());
}

function oauthToken() {
  return {
    status: 200,
    body: {
      access_token: `${SELLER_TOKEN_PREFIX}1`,
      refresh_token: 'TG-carga-refresh',
      expires_in: 15_552_000,
      user_id: 9_000_001,
      public_key: 'TEST-carga-public-key',
    },
  };
}

async function sendEmail({ request, body }) {
  if (!safeEqual(bearer(request), RESEND_API_KEY)) {
    return { status: 401, body: { statusCode: 401, name: 'validation_error', message: 'API key is invalid' } };
  }
  const receivedAt = Date.now();
  const verdict = resendLimits.admit(receivedAt);
  emails.push({
    receivedAt,
    to: [].concat(body.to ?? []).join(','),
    subject: body.subject,
    attachments: body.attachments?.length ?? 0,
    accepted: verdict.accepted,
    rejection: verdict.accepted ? undefined : verdict.body.name,
  });
  await delay(config.resendLatencyMs);
  if (!verdict.accepted) return { status: verdict.status, body: verdict.body };
  return { status: 200, body: { id: `email-${emails.length}` } };
}

function stats() {
  const resend = { accepted: 0, rejected: {} };
  for (const email of emails) {
    if (email.accepted) resend.accepted += 1;
    else resend.rejected[email.rejection] = (resend.rejected[email.rejection] ?? 0) + 1;
  }
  return {
    status: 200,
    body: {
      config,
      mercadoPago: mercadoPago.stats(),
      resend: { ...resend, usage: resendLimits.usage() },
      runs: runner.list().filter((run) => run.status === 'running'),
    },
  };
}

function updateConfig({ body }) {
  for (const [key, value] of Object.entries(body)) {
    if (!(key in config)) return { status: 400, body: { error: `unknown setting ${key}` } };
    if (key === 'resendPlan' ? !['free', 'pro'].includes(value) : !Number.isFinite(value) || value < 0) {
      return { status: 400, body: { error: `invalid value for ${key}` } };
    }
    config[key] = value;
  }
  resendLimits = newResendLimits();
  return { status: 200, body: config };
}

function reset() {
  mercadoPago.reset();
  emails = [];
  resendLimits = newResendLimits();
  return { status: 200, body: { ok: true } };
}

function records({ match }) {
  return {
    status: 200,
    body: match[1] === 'emails' ? emails : mercadoPago.paymentRecords(),
  };
}

async function startRun({ body }) {
  const result = await runner.start({ scenario: body.scenario, params: body.params });
  if (result.error) return { status: result.error === 'busy' ? 409 : 400, body: result };
  return { status: 202, body: result };
}

function getRun({ match }) {
  const run = runner.get(match[1]);
  return run ? { status: 200, body: run } : { status: 404, body: { error: 'not found' } };
}

async function probeRedis({ url }) {
  const samples = Math.min(Number(url.searchParams.get('n')) || 500, 5000);
  return { status: 200, body: await measureRedis(required('REDIS_URL'), samples) };
}

async function probeHttp({ url, match }) {
  const samples = Math.min(Number(url.searchParams.get('n')) || 20, 50);
  return { status: 200, body: await measureHttp(match[1], samples) };
}

// Mercado Pago simulado: solo con los tokens de los organizadores de carga.
function sellerOnly(handler) {
  return (context) => {
    if (!bearer(context.request).startsWith(SELLER_TOKEN_PREFIX)) {
      return { status: 401, body: { message: 'invalid access token', status: 401 } };
    }
    return handler(context);
  };
}

function control(handler) {
  return (context) => {
    if (!safeEqual(bearer(context.request), TOKEN)) {
      return { status: 401, body: { error: 'unauthorized' } };
    }
    return handler(context);
  };
}

function bearer(request) {
  const header = request?.headers.authorization ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function safeEqual(received, expected) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function delay(baseMs) {
  if (baseMs <= 0) return Promise.resolve();
  // ±25 % alrededor de la demora elegida.
  return new Promise((resolve) => setTimeout(resolve, baseMs * (0.75 + Math.random() * 0.5)));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.on('error', reject);
  });
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const route = routes.find(([method, pattern]) => method === request.method && pattern.test(url.pathname));
  let result;
  try {
    if (!route) {
      result = { status: 404, body: { error: 'not found' } };
    } else {
      const raw = await readBody(request);
      const body = raw ? JSON.parse(raw) : {};
      result = await route[2]({ request, url, body, match: url.pathname.match(route[1]) });
    }
  } catch (error) {
    console.error(`${request.method} ${url.pathname} failed:`, error.message);
    result = { status: 500, body: { error: 'internal error' } };
  }
  response.writeHead(result.status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(result.body));
});

// Muchas conexiones a la vez desde el backend y el generador.
server.keepAliveTimeout = 65_000;
server.maxRequestsPerSocket = 0;
server.listen(PORT, '::', () => console.log(`Load test service listening on ${PORT}`));

function required(name) {
  const value = process.env[name];
  if (!value) fail(`Missing ${name}`);
  return value;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
