import { randomUUID } from 'node:crypto';
import { RedisThrottlerStorage } from '../src/redis/redis-throttler.storage';
import { createTestApp, TestApp } from './utils/test-app';

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// El contador compartido en Redis cuenta igual que el de la librería en
// memoria: cada pedido deja de contar `ttl` después de hecho y, al pasar el
// límite, el visitante queda bloqueado `blockDuration`. Con tiempos cortos
// para no esperar minutos.
describe('Contador de límites en Redis', () => {
  let t: TestApp;
  let storage: RedisThrottlerStorage;

  beforeAll(async () => {
    t = await createTestApp();
    storage = t.app.get(RedisThrottlerStorage);
  });

  afterAll(() => t.close());

  type Limit = { ttl: number; limit: number; block?: number };
  const hit = (visitor: string, { ttl, limit, block = ttl }: Limit) =>
    storage.increment(visitor, ttl, limit, block, 'default');

  it('el primer pedido informa cuántos quedan y cuándo se renueva el límite', async () => {
    const record = await hit(randomUUID(), { ttl: 60_000, limit: 100 });

    expect(record).toMatchObject({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
    });
  });

  it('cada pedido deja de contar a su tiempo, no al cerrar una ventana fija', async () => {
    const visitor = randomUUID();
    const limit = { ttl: 2000, limit: 10 };
    await hit(visitor, limit);
    await sleep(1200);
    await hit(visitor, limit);
    await sleep(1000);

    const record = await hit(visitor, limit);

    // The first one expired; the second one still counts.
    expect(record.totalHits).toBe(2);
  });

  it('al pasar el límite queda bloqueado, lo que pide mientras tanto no suma y al terminar arranca de cero', async () => {
    const visitor = randomUUID();
    const limit = { ttl: 1500, limit: 2 };
    await hit(visitor, limit);
    await hit(visitor, limit);

    expect(await hit(visitor, limit)).toMatchObject({
      totalHits: 3,
      isBlocked: true,
      timeToBlockExpire: 2,
    });
    expect(await hit(visitor, limit)).toMatchObject({
      totalHits: 3,
      isBlocked: true,
    });

    await sleep(1600);
    expect(await hit(visitor, limit)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('que a un visitante se le venza el bloqueo no congela los contadores de los demás', async () => {
    const [blocked, other] = [randomUUID(), randomUUID()];
    const limit = { ttl: 1000, limit: 2, block: 300 };
    await hit(other, limit);
    for (let i = 0; i < 3; i++) await hit(blocked, limit);
    await sleep(400);
    // Its block ended.
    await hit(blocked, limit);
    await sleep(700);

    // The other visitor's first request is older than the ttl.
    expect((await hit(other, limit)).totalHits).toBe(1);
  });
});
