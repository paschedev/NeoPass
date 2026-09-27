import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsRepository } from './repositories/events.repository';

@Injectable()
export class EventsLifecycleService {
  private readonly logger = new Logger(EventsLifecycleService.name);

  constructor(private readonly eventsRepository: EventsRepository) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleFinishedEvents() {
    try {
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
