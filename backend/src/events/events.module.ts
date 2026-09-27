import { EventsLifecycleService } from './events-lifecycle.service';
import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BatchCronService } from './batch-cron.service';
import { EventsRepository } from './repositories/events.repository';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, AuthModule, NotificationsModule],
  controllers: [EventsController],
  providers: [
    EventsLifecycleService,
    EventsService,
    BatchCronService,
    EventsRepository,
  ],
})
export class EventsModule {}
