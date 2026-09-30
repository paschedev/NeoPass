import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsProcessor } from './payments.processor';
import { TicketsModule } from '../tickets/tickets.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsRepository } from './repositories/payments.repository';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service';
import { MercadoPagoTokenCipher } from './mercadopago-token-cipher';
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
  providers: [
    PaymentsService,
    PaymentsRepository,
    PaymentsProcessor,
    MercadoPagoOAuthService,
    {
      provide: MercadoPagoTokenCipher,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new MercadoPagoTokenCipher(
          config.getOrThrow<string>('MERCADOPAGO_TOKEN_KEY'),
        ),
    },
  ],
  exports: [PaymentsService, MercadoPagoTokenCipher],
})
export class PaymentsModule {}
