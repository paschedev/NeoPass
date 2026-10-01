import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
  Ip,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateBatchesDto } from './dto/update-batches.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { ParseIdPipe } from '../common/parse-id.pipe';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findPublicPage(@Query() query: ListEventsQueryDto) {
    return this.eventsService.findPublicPage(query.page, query.limit);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/me')
  findMyEvents(@CurrentUser('userId') userId: string) {
    return this.eventsService.findByOrganizer(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/staff')
  getOrganizerStaff(@CurrentUser('userId') userId: string) {
    return this.eventsService.getOrganizerStaff(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/stats')
  getOrganizerStats(@CurrentUser('userId') userId: string) {
    return this.eventsService.getOrganizerStats(userId);
  }

  // After the fixed organizer/* routes so it doesn't swallow them.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/:id')
  findOneForOrganizer(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.findOneForOrganizer(id, userId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIdPipe) id: string,
    @Ip() visitorIp: string,
    @Query('rpp') rppId?: string,
  ) {
    return this.eventsService.findOne(id, rppId, visitorIp);
  }

  @Get(':id/promoters')
  getPublicPromoters(@Param('id', ParseIdPipe) id: string) {
    return this.eventsService.getPublicPromoters(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post()
  create(@Body() body: CreateEventDto, @CurrentUser('userId') userId: string) {
    return this.eventsService.create(userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Put(':id')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: UpdateEventDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.update(id, userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Put(':id/batches')
  updateBatches(
    @Param('id', ParseIdPipe) eventId: string,
    @Body() body: UpdateBatchesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.updateBatches(eventId, userId, body.batches);
  }

  // --- STAFF ENDPOINTS ---

  @UseGuards(JwtAuthGuard)
  @Get('promoter/me')
  getMyPromoterStats(@CurrentUser('userId') userId: string) {
    return this.eventsService.getMyPromoterStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('promoter/me/:eventId/stats')
  getPromoterEventStats(
    @Param('eventId', ParseIdPipe) eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getPromoterEventStats(userId, eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post(':id/staff')
  addStaff(
    @Param('id', ParseIdPipe) eventId: string,
    @Body() body: AddStaffDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.addStaff(
      eventId,
      userId,
      body.userId,
      body.role,
      body.commissionType,
      body.commissionValue,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/staff')
  getStaff(
    @Param('id', ParseIdPipe) eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getEventStaff(eventId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('staff/:eventStaffId/accept')
  acceptInvitation(
    @Param('eventStaffId', ParseIdPipe) eventStaffId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.acceptInvitation(eventStaffId, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('staff/:eventStaffId/reject')
  rejectInvitation(
    @Param('eventStaffId', ParseIdPipe) eventStaffId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.rejectInvitation(eventStaffId, userId);
  }
}
