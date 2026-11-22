// REDIS_URL as Railway gives it (redis://user:password@host:port), for BullMQ
// and for the app's own connection.
export function redisConnection(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
    username: url.username || undefined,
    password: url.password || undefined,
  };
}
