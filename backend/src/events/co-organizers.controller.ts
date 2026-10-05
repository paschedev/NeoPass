import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { CoOrganizersService } from './co-organizers.service';
import { UpdateCoOrganizerDto } from './dto/update-co-organizer.dto';
import { ListActivityQueryDto } from './dto/list-activity-query.dto';

// Only the event's owner: co-organizers and the history of the event. They
// are invited like the rest of the staff (POST /events/:id/staff).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ORGANIZER', 'ADMIN')
@Controller('events/organizer/:eventId')
export class CoOrganizersController {
  constructor(private readonly coOrganizersService: CoOrganizersService) {}

  @Get('co-organizers')
  list(
    @Param('eventId', ParseIdPipe) eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.coOrganizersService.list(eventId, userId);
  }

  @Put('co-organizers/:staffId')
  update(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Param('staffId', ParseIdPipe) staffId: string,
    @Body() body: UpdateCoOrganizerDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.coOrganizersService.update(eventId, staffId, userId, body);
  }

  @Delete('co-organizers/:staffId')
  remove(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Param('staffId', ParseIdPipe) staffId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.coOrganizersService.remove(eventId, staffId, userId);
  }

  @Get('activity')
  activity(
    @Param('eventId', ParseIdPipe) eventId: string,
    @Query() query: ListActivityQueryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.coOrganizersService.activity(eventId, userId, query.page);
  }
}
