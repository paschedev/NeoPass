import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { AdminService } from './admin.service';
import { ListAdminEventsQueryDto } from './dto/list-admin-events-query.dto';
import { UpdateServiceFeeDto } from './dto/update-service-fee.dto';

// NeoPass's own panel: only the ADMIN account, whatever event it is.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('events')
  listEvents(@Query() query: ListAdminEventsQueryDto) {
    return this.adminService.listEvents(query.q, query.page);
  }

  @Patch('events/:id/service-fee')
  updateServiceFee(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: UpdateServiceFeeDto,
  ) {
    return this.adminService.updateServiceFee(id, body.percentage);
  }
}
