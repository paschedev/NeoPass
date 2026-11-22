import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { EventsRepository } from './repositories/events.repository';

const CLICK_WINDOW_MS = 60 * 60 * 1000;

// Counts visits to a promoter's link: once per visitor (IP) and promoter per
// hour, and only for an accepted promoter of the event, so reloading the page
// does not inflate the counter. The recent visits live in Redis, shared by
// every replica and under a hash instead of the IP. If Redis does not answer,
// the visit is not counted.
@Injectable()
export class PromoterClicksService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly redis: RedisService,
  ) {}

  async register(eventId: string, promoterId: string, visitorIp: string) {
    const visit = `promoter-click:${createHash('sha256')
      .update(`${promoterId}:${visitorIp}`)
      .digest('hex')}`;
    let firstThisHour: boolean;
    try {
      firstThisHour =
        (await this.redis.client.set(visit, 1, 'PX', CLICK_WINDOW_MS, 'NX')) ===
        'OK';
    } catch (error) {
      this.redis.warnUnavailable('promoter clicks', error);
      return;
    }
    if (!firstThisHour) return;

    const counted = await this.eventsRepository.incrementAcceptedPromoterClicks(
      eventId,
      promoterId,
    );
    // Not a promoter of this event: nothing to remember.
    if (!counted) {
      await this.redis.client
        .del(visit)
        .catch((error: unknown) =>
          this.redis.warnUnavailable('promoter clicks', error),
        );
    }
  }
}
