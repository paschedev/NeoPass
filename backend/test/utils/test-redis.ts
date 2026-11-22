import type Redis from 'ioredis';

const TEST_REDIS_PORT = 6380;

// Freno de seguridad: solo se vacía el Redis de prueba (redis-test de
// docker-compose), nunca el de desarrollo (:6379), que tiene las colas.
export async function emptyTestRedis(redis: Redis) {
  const { host, port } = redis.options;
  if (
    !['localhost', '127.0.0.1'].includes(host ?? '') ||
    port !== TEST_REDIS_PORT
  ) {
    throw new Error(
      `Refusing to empty Redis at ${host}:${port}: test helpers only touch localhost:${TEST_REDIS_PORT}`,
    );
  }
  await redis.flushdb();
}
