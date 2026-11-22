import { Global, Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';
import { RedisService } from './redis.service';
import { ScheduledTurns } from './scheduled-turns';

// What the replicas share through Redis. Global, like the configuration.
@Global()
@Module({
  providers: [RedisService, RedisThrottlerStorage, ScheduledTurns],
  exports: [RedisService, RedisThrottlerStorage, ScheduledTurns],
})
export class RedisModule {}
