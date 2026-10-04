import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { SendFreeTicketsDto } from './dto/send-free-tickets.dto';
import { FreeTicketsService } from './free-tickets.service';

// Free tickets ("QR free") the organizer sends from the event detail.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
@Controller('events/organizer/:eventId/free-tickets')
export class FreeTicketsController {
  constructor(private readonly freeTicketsService: FreeTicketsService) {}

  @Post()
  send(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Body() body: SendFreeTicketsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.freeTicketsService.send(eventId, userId, body);
  }

  @Get()
  list(
    @Param('eventId', ParseIdPipe) eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.freeTicketsService.list(eventId, userId);
  }

  @Post(':grantId/cancel')
  cancel(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Param('grantId', ParseIdPipe) grantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.freeTicketsService.cancel(eventId, grantId, userId);
  }

  @Post(':grantId/resend')
  resend(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Param('grantId', ParseIdPipe) grantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.freeTicketsService.resend(eventId, grantId, userId);
  }
}
