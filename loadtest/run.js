// Corre escenarios en el servicio de carga desde cualquier PC y guarda un
// resumen por corrida. Git Bash, desde la raíz del repo:
//   LOADTEST_URL=https://<servicio de carga> LOADTEST_TOKEN=<token> \
//   node loadtest/run.js navigation RATE=100 DURATION=60s
// Con --steps repite el escenario con cada valor, de a uno:
//   node loadtest/run.js navigation DURATION=60s --steps RATE=50,100,200
// Los resúmenes van a RESULTS_DIR (por defecto, la carpeta temporal): nunca
// al repo, que es público.
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.LOADTEST_URL;
const TOKEN = process.env.LOADTEST_TOKEN;
const RESULTS_DIR = process.env.RESULTS_DIR ?? join(tmpdir(), 'neopass-carga');
const POLL_MS = 5000;

if (!BASE || !TOKEN) {
  console.error('Faltan LOADTEST_URL y LOADTEST_TOKEN');
  process.exit(1);
}

const [scenario, ...rest] = process.argv.slice(2);
const params = {};
let steps = [{}];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--steps') {
    const [name, values] = rest[++i].split('=');
    steps = values.split(',').map((value) => ({ [name]: value }));
    continue;
  }
  const [name, value] = rest[i].split('=');
  params[name] = value;
}

async function control(path, init = {}) {
  const response = await fetch(`${BASE}/_control${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Lo que importa de un resumen de k6.
function compact(summary) {
  const metrics = summary?.metrics ?? {};
  const values = (name) => metrics[name]?.values ?? {};
  const pick = (name) => {
    const { med, 'p(90)': p90, 'p(95)': p95, 'p(99)': p99, max, count } = values(name);
    return { med, p90, p95, p99, max, count };
  };
  return {
    requestsPerSecond: values('http_reqs').rate,
    requests: values('http_reqs').count,
    droppedIterations: values('dropped_iterations').count ?? 0,
    maxVUs: values('vus_max').max,
    receivedMB: (values('data_received').count ?? 0) / 1e6,
    timings: Object.fromEntries(
      Object.keys(metrics)
        .filter((name) => name.endsWith('_ms'))
        .map((name) => [name, pick(name)]),
    ),
    counts: Object.fromEntries(
      Object.keys(metrics)
        .filter((name) => name.startsWith('responses_') || name.startsWith('checkin_'))
        .filter((name) => !name.endsWith('_ms'))
        .map((name) => [name, values(name).count]),
    ),
  };
}

const results = [];
await mkdir(RESULTS_DIR, { recursive: true });
const file = join(RESULTS_DIR, `${scenario}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

for (const step of steps) {
  const runParams = { ...params, ...step };
  const { runId } = await control('/runs', {
    method: 'POST',
    body: JSON.stringify({ scenario, params: runParams }),
  });
  let run;
  do {
    await sleep(POLL_MS);
    run = await control(`/runs/${runId}`);
  } while (run.status === 'running');

  const result = {
    scenario,
    params: runParams,
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    ...compact(run.summary),
    ...(run.status === 'done' ? {} : { output: run.output }),
  };
  results.push(result);
  await writeFile(file, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ params: runParams, status: run.status, rps: result.requestsPerSecond, timings: result.timings, counts: result.counts, dropped: result.droppedIterations }));
}
console.log(`Resumen: ${file}`);
