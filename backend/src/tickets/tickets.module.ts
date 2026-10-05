import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { TicketsRepository } from './repositories/tickets.repository';
import { FreeTicketsController } from './free-tickets.controller';
import { FreeTicketsService } from './free-tickets.service';
import { FreeTicketsRepository } from './repositories/free-tickets.repository';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../mail/mail.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [PrismaModule, NotificationsModule, MailModule, EventsModule],
  controllers: [TicketsController, FreeTicketsController],
  providers: [
    TicketsService,
    TicketsRepository,
    FreeTicketsService,
    FreeTicketsRepository,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}
