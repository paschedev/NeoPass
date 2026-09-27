import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsProcessor } from './payments.processor';
import { TicketsModule } from '../tickets/tickets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsRepository } from './repositories/payments.repository';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TicketsModule,
    PrismaModule,
    AuthModule,
    NotificationsModule,
    BullModule.registerQueue({ name: 'payments' }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentsRepository, PaymentsProcessor],
  exports: [PaymentsService],
})
export class PaymentsModule {}
