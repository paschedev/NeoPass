import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ScheduledTurns } from '../redis/scheduled-turns';
import { EventsRepository } from './repositories/events.repository';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

@Injectable()
export class EventsLifecycleService {
  private readonly logger = new Logger(EventsLifecycleService.name);

  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly turns: ScheduledTurns,
  ) {}

  // With several replicas, only one of them runs each turn.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFinishedEvents() {
    try {
      if (!(await this.turns.claim('finish-ended-events', FIVE_MINUTES_MS))) {
        return;
      }
      await this.finishEndedEvents(new Date());
    } catch (error) {
      this.logger.error('Error finishing ended events', error);
    }
  }

  // A published event whose end date passed leaves the public listing and
  // stops selling. The clock is a parameter so tests can fix it.
  async finishEndedEvents(now: Date) {
    const { count } =
      await this.eventsRepository.finishPublishedEventsEndedBefore(now);
    if (count > 0) {
      this.logger.log(`Finished ${count} events that already ended`);
    }
  }
}
