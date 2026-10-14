import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { AdminService } from './admin.service';
import { AdminSearchQueryDto } from './dto/admin-search-query.dto';
import { UpdateServiceFeeDto } from './dto/update-service-fee.dto';

const HOUR_MS = 60 * 60 * 1000;

// NeoPass's own panel: only the ADMIN account, whatever event it is.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('events')
  listEvents(@Query() query: AdminSearchQueryDto) {
    return this.adminService.listEvents(query.q, query.page);
  }

  @Get('tickets')
  listTickets(@Query() query: AdminSearchQueryDto) {
    return this.adminService.listTickets(query.q, query.page);
  }

  // A cap so that it can't be used to send mail in bulk.
  @Throttle({ default: { limit: 10, ttl: HOUR_MS } })
  @Post('tickets/:id/resend')
  resendTicket(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.resendTicket(id, adminId);
  }

  @Patch('events/:id/service-fee')
  updateServiceFee(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: UpdateServiceFeeDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.updateServiceFee(id, body.percentage, adminId);
  }

  @Patch('events/:id/restore')
  restoreEvent(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.adminService.restoreEvent(id, adminId);
  }
}
