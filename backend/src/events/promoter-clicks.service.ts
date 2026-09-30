import { Injectable } from '@nestjs/common';
import { EventsRepository } from './repositories/events.repository';

const CLICK_WINDOW_MS = 60 * 60 * 1000;

// Counts visits to a promoter's link: once per visitor (IP) and promoter per
// hour, and only for an accepted promoter of the event, so reloading the page
// does not inflate the counter. The recent visits live in memory: a deploy
// forgets them, which lets at most one extra click per visitor through.
@Injectable()
export class PromoterClicksService {
  // Key → when it expires. Every entry lasts the same, so the insertion order
  // is also the expiration order.
  private readonly recentVisits = new Map<string, number>();

  constructor(private readonly eventsRepository: EventsRepository) {}

  async register(
    eventId: string,
    promoterId: string,
    visitorIp: string,
    now = Date.now(),
  ) {
    this.forgetExpired(now);
    const key = `${promoterId}:${visitorIp}`;
    if (this.recentVisits.has(key)) return;

    this.recentVisits.set(key, now + CLICK_WINDOW_MS);
    const counted = await this.eventsRepository.incrementAcceptedPromoterClicks(
      eventId,
      promoterId,
    );
    // Not a promoter of this event: nothing to remember.
    if (!counted) this.recentVisits.delete(key);
  }

  private forgetExpired(now: number) {
    for (const [key, expiresAt] of this.recentVisits) {
      if (expiresAt > now) break;
      this.recentVisits.delete(key);
    }
  }
}
