import { EventsLifecycleService } from './events-lifecycle.service';
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EventsRepository } from './repositories/events.repository';
import { PromoterClicksService } from './promoter-clicks.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CoOrganizersController } from './co-organizers.controller';
import { CoOrganizersService } from './co-organizers.service';
import { CoOrganizersRepository } from './repositories/co-organizers.repository';
import { EventAccessService } from './event-access.service';
import { EventAccessRepository } from './repositories/event-access.repository';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [EventsController, CoOrganizersController],
  providers: [
    EventsLifecycleService,
    EventsService,
    EventsRepository,
    PromoterClicksService,
    CoOrganizersService,
    CoOrganizersRepository,
    EventAccessService,
    EventAccessRepository,
  ],
})
export class EventsModule {}
