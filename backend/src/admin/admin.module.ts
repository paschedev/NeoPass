import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './repositories/admin.repository';

@Module({
  imports: [NotificationsModule, MailModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
