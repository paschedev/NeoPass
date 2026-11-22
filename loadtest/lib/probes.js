import { connect } from 'node:net';

// Percentiles de una lista de duraciones en ms.
export function summarize(durations) {
  const sorted = [...durations].sort((a, b) => a - b);
  const at = (p) =>
    sorted.length === 0
      ? null
      : round(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]);
  return {
    count: sorted.length,
    p50: at(50),
    p95: at(95),
    p99: at(99),
    max: at(100),
  };
}

function round(ms) {
  return Math.round(ms * 100) / 100;
}

// Ida y vuelta a Redis desde la misma red que el backend: un PING y un script
// parecido al del límite de pedidos (agrega, vence y cuenta), uno por vez,
// sobre una conexión ya abierta, como la del backend.
export async function measureRedis(redisUrl, samples) {
  const url = new URL(redisUrl);
  const client = await openRedis(url);
  try {
    if (url.password) {
      await client.command(
        url.username
          ? ['AUTH', decodeURIComponent(url.username), decodeURIComponent(url.password)]
          : ['AUTH', decodeURIComponent(url.password)],
      );
    }
    const ping = [];
    const script = [];
    for (let i = 0; i < samples; i++) {
      let start = performance.now();
      await client.command(['PING']);
      ping.push(performance.now() - start);

      start = performance.now();
      await client.command([
        'EVAL',
        "redis.call('ZADD', KEYS[1], ARGV[1], ARGV[2]); redis.call('PEXPIRE', KEYS[1], 60000); return redis.call('ZCARD', KEYS[1])",
        '1',
        'carga:probe',
        String(Date.now()),
        `${i}`,
      ]);
      script.push(performance.now() - start);
    }
    return { ping: summarize(ping), throttleLikeScript: summarize(script) };
  } finally {
    client.close();
  }
}

// Cliente RESP mínimo: un comando por vez, respuestas de una línea.
function openRedis(url) {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: url.hostname, port: Number(url.port || 6379) });
    let buffer = '';
    let pending = null;
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      const end = buffer.indexOf('\r\n');
      if (end === -1 || !pending) return;
      const line = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const { resolve: done, reject: fail } = pending;
      pending = null;
      if (line.startsWith('-')) fail(new Error(line.slice(1)));
      else done(line);
    });
    socket.on('error', (error) => {
      if (pending) pending.reject(error);
      reject(error);
    });
    socket.on('connect', () =>
      resolve({
        command: (args) =>
          new Promise((done, fail) => {
            pending = { resolve: done, reject: fail };
            socket.write(
              `*${args.length}\r\n${args
                .map((arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`)
                .join('')}`,
            );
          }),
        close: () => socket.end(),
      }),
    );
  });
}

// Servicios externos que el backend llama en una compra, medidos desde la
// misma región. Turnstile con la clave de prueba de Cloudflare que siempre
// aprueba; Mercado Pago sin credenciales (responde 401: mide la ida y vuelta
// y su borde, no lo que tarda en crear una preferencia).
const HTTP_TARGETS = {
  turnstile: () =>
    fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: '1x0000000000000000000000000000000AA',
        response: 'XXXX.DUMMY.TOKEN.XXXX',
      }),
    }),
  mercadopago: () => fetch('https://api.mercadopago.com/v1/payments/1'),
};

export async function measureHttp(target, samples) {
  const call = HTTP_TARGETS[target];
  if (!call) throw new Error(`Unknown target: ${target}`);
  const durations = [];
  const statuses = {};
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const response = await call();
    await response.arrayBuffer();
    durations.push(performance.now() - start);
    statuses[response.status] = (statuses[response.status] ?? 0) + 1;
  }
  return { ...summarize(durations), statuses };
}
