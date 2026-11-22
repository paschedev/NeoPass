import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Escenarios que se pueden correr: el que llama elige uno por nombre y sus
// parámetros, nunca un archivo ni la URL a la que apunta (BACKEND_URL es fija).
const SCENARIOS = ['navigation', 'checkout', 'payments', 'checkin'];
const PARAM_NAME = /^[A-Z][A-Z0-9_]{0,40}$/;
const PARAM_VALUE = /^[\w.,:-]{0,200}$/;
const OUTPUT_TAIL = 20_000;

// `prepareData(scenario, params)` arma lo que k6 lee de un archivo (sesiones,
// avisos firmados): así los escenarios no firman nada.
export function createRunner(fixedEnv, prepareData) {
  const runs = new Map();
  let active = null;

  async function start({ scenario, params = {} }) {
    if (active) return { error: 'busy', runId: active };
    if (!SCENARIOS.includes(scenario)) return { error: 'unknown scenario' };
    for (const [name, value] of Object.entries(params)) {
      if (!PARAM_NAME.test(name) || !PARAM_VALUE.test(String(value))) {
        return { error: `invalid parameter ${name}` };
      }
    }

    const id = randomUUID();
    active = id;
    const summaryPath = `/tmp/k6-${id}-summary.json`;
    const dataPath = `/tmp/k6-${id}-data.json`;
    const run = {
      id,
      scenario,
      params,
      status: 'running',
      startedAt: new Date().toISOString(),
      output: '',
    };
    runs.set(id, run);

    try {
      await writeFile(dataPath, JSON.stringify(prepareData(scenario, params)));
    } catch (error) {
      run.status = 'failed';
      run.output = `Could not prepare the data: ${error.message}`;
      active = null;
      return { runId: id };
    }

    const file = fileURLToPath(
      new URL(`../scenarios/${scenario}.js`, import.meta.url),
    );
    const child = spawn('k6', ['run', '--no-color', '--quiet', file], {
      env: {
        PATH: process.env.PATH,
        HOME: '/tmp',
        K6_NO_USAGE_REPORT: 'true',
        ...Object.fromEntries(
          Object.entries(params).map(([name, value]) => [name, String(value)]),
        ),
        ...fixedEnv,
        SUMMARY_PATH: summaryPath,
        DATA_PATH: dataPath,
      },
    });
    const keepTail = (chunk) => {
      run.output = (run.output + chunk.toString()).slice(-OUTPUT_TAIL);
    };
    child.stdout.on('data', keepTail);
    child.stderr.on('data', keepTail);
    child.on('error', (error) => keepTail(`\n${error.message}`));
    child.on('close', async (exitCode) => {
      run.exitCode = exitCode;
      run.finishedAt = new Date().toISOString();
      try {
        run.summary = JSON.parse(await readFile(summaryPath, 'utf8'));
        run.status = 'done';
      } catch {
        run.status = 'failed';
      }
      await rm(summaryPath, { force: true });
      await rm(dataPath, { force: true });
      active = null;
    });
    return { runId: id };
  }

  return {
    start,
    get: (id) => runs.get(id),
    list: () =>
      [...runs.values()].map(
        ({ id, scenario, params, status, startedAt, finishedAt }) => ({
          id,
          scenario,
          params,
          status,
          startedAt,
          finishedAt,
        }),
      ),
  };
}
