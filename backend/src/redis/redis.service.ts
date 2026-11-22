import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { redisConnection } from './redis-connection';

// A command that takes longer than this counts as Redis not answering.
const COMMAND_TIMEOUT_MS = 1000;
const WARNING_INTERVAL_MS = 60 * 1000;

// The app's own connection to the Redis of the queues, for what the replicas
// share: request limits, promoter clicks and the turns of the crons. It is not
// BullMQ's: its connections retry forever, and a request must not hang while
// Redis is away. Here a command fails at once when Redis is unreachable, and
// every use has its own fallback. The connection comes back by itself.
@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);
  private reachable = true;
  private readonly lastWarnings = new Map<string, number>();

  constructor(config: ConfigService) {
    this.client = new Redis({
      ...redisConnection(config.getOrThrow<string>('REDIS_URL')),
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      commandTimeout: COMMAND_TIMEOUT_MS,
    });
    // Without a listener, a connection error would crash the process. While
    // Redis is away the client retries every couple of seconds: logged once.
    this.client.on('error', (error) => {
      if (!this.reachable) return;
      this.reachable = false;
      this.logger.error('Redis is unreachable', error);
    });
    this.client.on('ready', () => {
      if (this.reachable) return;
      this.reachable = true;
      this.logger.log('Redis is reachable again');
    });
  }

  // Waits for the connection so the first requests already share the
  // counters. If Redis is down the app starts anyway and keeps retrying.
  async onModuleInit() {
    try {
      await this.client.connect();
    } catch {
      // Logged by the error listener.
    }
  }

  async onApplicationShutdown() {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  // A use that fell back because Redis failed, logged at most once a minute
  // so an outage does not flood the logs.
  warnUnavailable(use: string, error: unknown) {
    const now = Date.now();
    if (now - (this.lastWarnings.get(use) ?? 0) < WARNING_INTERVAL_MS) return;
    this.lastWarnings.set(use, now);
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis did not answer for ${use}: ${reason}`);
  }
}
