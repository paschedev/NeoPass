import { randomUUID } from 'node:crypto';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import type { Result } from 'ioredis';
import { RedisService } from './redis.service';

type ThrottlerStorageRecord = Awaited<
  ReturnType<ThrottlerStorage['increment']>
>;

// The rules of the library's in-memory storage, run atomically in Redis so
// every replica shares the counters: each request stops counting `ttl` after
// it was made; going over the limit blocks for `blockDuration`; requests made
// while blocked do not count; and the count starts over when the block ends.
// The window only feeds the X-RateLimit-Reset header: it starts with a
// request and restarts with the first one after it ends. The clock is
// Redis's, the same for every replica.
// Returns { requests that count, ms left in the window, ms left blocked }.
const HIT_SCRIPT = `
local hits, window, block = KEYS[1], KEYS[2], KEYS[3]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', hits, '-inf', now - ttl)

local windowLeft = redis.call('PTTL', window)
if windowLeft <= 0 then
  redis.call('SET', window, 1, 'PX', ttl)
  windowLeft = ttl
end

local blockedUntil = tonumber(redis.call('GET', block))
if blockedUntil and blockedUntil <= now then
  redis.call('DEL', hits, block)
  blockedUntil = nil
end

if not blockedUntil then
  redis.call('ZADD', hits, now, ARGV[4])
  redis.call('PEXPIRE', hits, ttl)
  if redis.call('ZCARD', hits) > limit then
    blockedUntil = now + blockDuration
    -- Kept past the block so the next request still sees it ended.
    redis.call('SET', block, blockedUntil, 'PX', blockDuration + ttl)
  end
end

local blockLeft = 0
if blockedUntil then
  blockLeft = blockedUntil - now
end
return { redis.call('ZCARD', hits), windowLeft, blockLeft }
`;

declare module 'ioredis' {
  interface RedisCommander<Context> {
    throttlerHit(
      hits: string,
      window: string,
      block: string,
      ttl: number,
      limit: number,
      blockDuration: number,
      hitId: string,
    ): Result<[number, number, number], Context>;
  }
}

// Request limits shared by every replica, for both throttler guards.
@Injectable()
export class RedisThrottlerStorage
  implements ThrottlerStorage, OnApplicationShutdown
{
  // While Redis does not answer, each replica counts on its own, as a single
  // instance did before.
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {
    redis.client.defineCommand('throttlerHit', {
      numberOfKeys: 3,
      lua: HIT_SCRIPT,
    });
  }

  // `key` is already a hash of the route, the throttler and the client.
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      const [totalHits, windowLeft, blockLeft] =
        await this.redis.client.throttlerHit(
          `throttle:${key}:hits`,
          `throttle:${key}:window`,
          `throttle:${key}:block`,
          ttl,
          limit,
          blockDuration,
          randomUUID(),
        );
      return {
        totalHits,
        timeToExpire: Math.ceil(windowLeft / 1000),
        isBlocked: blockLeft > 0,
        timeToBlockExpire: Math.ceil(blockLeft / 1000),
      };
    } catch (error) {
      this.redis.warnUnavailable('request limits', error);
      return this.fallback.increment(
        key,
        ttl,
        limit,
        blockDuration,
        throttlerName,
      );
    }
  }

  onApplicationShutdown() {
    this.fallback.onApplicationShutdown();
  }
}
