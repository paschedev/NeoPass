import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './repositories/admin.repository';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
