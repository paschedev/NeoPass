import { EventsLifecycleService } from './events-lifecycle.service';
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsRepository } from './repositories/events.repository';
import { PromoterClicksService } from './promoter-clicks.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [EventsController],
  providers: [
    EventsLifecycleService,
    EventsService,
    EventsRepository,
    PromoterClicksService,
  ],
})
export class EventsModule {}
