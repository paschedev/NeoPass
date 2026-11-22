import { hostname } from 'node:os';
import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

// Every replica fires its own copy of a cron at the same moment: the first to
// claim the turn runs it and the rest skip it. A turn is the slice of
// `periodMs` that holds `now`, so replicas whose clocks differ slightly claim
// the same one. If Redis does not answer, nobody runs that turn and the next
// one does.
@Injectable()
export class ScheduledTurns {
  constructor(private readonly redis: RedisService) {}

  async claim(task: string, periodMs: number, now = Date.now()) {
    const turn = Math.floor(now / periodMs) * periodMs;
    try {
      const claimed = await this.redis.client.set(
        `scheduled:${task}:${turn}`,
        hostname(),
        'PX',
        periodMs,
        'NX',
      );
      return claimed === 'OK';
    } catch (error) {
      this.redis.warnUnavailable(`the ${task} turn`, error);
      return false;
    }
  }
}
