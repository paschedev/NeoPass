import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { Prisma, StaffRole, CommissionType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { UpdateBatchesDto } from './dto/update-batches.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListEventsQueryDto } from './dto/list-events-query.dto';

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
  findMyEvents(@Req() req: any) {
    return this.eventsService.findByOrganizer(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/staff')
  getOrganizerStaff(@Req() req: any) {
    return this.eventsService.getOrganizerStaff(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/stats')
  getOrganizerStats(@Req() req: any) {
    return this.eventsService.getOrganizerStats(req.user.userId);
  }

  // After the fixed organizer/* routes so it doesn't swallow them.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/:id')
  findOneForOrganizer(
    @Param('id') id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.findOneForOrganizer(id, userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Query('rpp') rppId?: string) {
    return this.eventsService.findOne(id, rppId);
  }

  @Get(':id/promoters')
  getPublicPromoters(@Param('id') id: string) {
    return this.eventsService.getPublicPromoters(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post()
  create(@Body() body: CreateEventDto, @Req() req: any) {
    return this.eventsService.create(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateEventDto,
    @Req() req: any,
  ) {
    return this.eventsService.update(id, req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Put(':id/batches')
  updateBatches(
    @Param('id') eventId: string,
    @Body() body: UpdateBatchesDto,
    @Req() req: any,
  ) {
    return this.eventsService.updateBatches(
      eventId,
      req.user.userId,
      body.batches,
    );
  }

  // --- STAFF ENDPOINTS ---

  @UseGuards(JwtAuthGuard)
  @Get('promoter/me')
  getMyPromoterStats(@Req() req: any) {
    return this.eventsService.getMyPromoterStats(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('promoter/me/:eventId/stats')
  getPromoterEventStats(@Param('eventId') eventId: string, @Req() req: any) {
    return this.eventsService.getPromoterEventStats(req.user.userId, eventId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Post(':id/staff')
  addStaff(
    @Param('id') eventId: string,
    @Body() body: AddStaffDto,
    @Req() req: any,
  ) {
    return this.eventsService.addStaff(
      eventId,
      req.user.userId,
      body.userId,
      body.role,
      body.commissionType,
      body.commissionValue,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get(':id/staff')
  getStaff(@Param('id') eventId: string, @Req() req: any) {
    return this.eventsService.getEventStaff(eventId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('staff/:eventStaffId/accept')
  acceptInvitation(
    @Param('eventStaffId') eventStaffId: string,
    @Req() req: any,
  ) {
    return this.eventsService.acceptInvitation(eventStaffId, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('staff/:eventStaffId/reject')
  rejectInvitation(
    @Param('eventStaffId') eventStaffId: string,
    @Req() req: any,
  ) {
    return this.eventsService.rejectInvitation(eventStaffId, req.user.userId);
  }
}
