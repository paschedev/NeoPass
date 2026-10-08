import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Query,
  Ip,
  Header,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { DeleteEventDto } from './dto/delete-event.dto';
import { UserRole } from '@prisma/client';
import { UpdateBatchesDto } from './dto/update-batches.dto';
import { BatchSaleActionDto } from './dto/batch-sale-action.dto';
import { RegisterPromoterPaymentDto } from './dto/register-promoter-payment.dto';
import { UpdatePromoterFreeTicketsDto } from './dto/update-promoter-free-tickets.dto';
import { ListAttendeesQueryDto } from './dto/list-attendees-query.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { ParseIdPipe } from '../common/parse-id.pipe';

// The routes of one event are for its team: the owner and the co-organizers,
// who can have any account. The service checks who can do what on each event.
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
  @Get('organizer/staff/overview')
  getStaffOverview(@CurrentUser('userId') userId: string) {
    return this.eventsService.getStaffOverview(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ORGANIZER', 'ADMIN')
  @Get('organizer/stats')
  getOrganizerStats(@CurrentUser('userId') userId: string) {
    return this.eventsService.getOrganizerStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id/sales')
  getEventSales(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getEventSales(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id/attendees')
  getEventAttendees(
    @Param('id', ParseIdPipe) id: string,
    @Query() query: ListAttendeesQueryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getEventAttendees(id, userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id/attendees/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="publico.csv"')
  exportEventAttendees(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.exportEventAttendees(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id/check-ins')
  getEventCheckIns(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getEventCheckIns(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id/promoters')
  getEventPromoters(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getEventPromoters(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('organizer/:id/promoters/:staffId/payments')
  registerPromoterPayment(
    @Param('id', ParseIdPipe) id: string,
    @Param('staffId', ParseIdPipe) staffId: string,
    @Body() body: RegisterPromoterPaymentDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.registerPromoterPayment(
      id,
      userId,
      staffId,
      body,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('organizer/:id/promoters/:staffId/free-tickets')
  updatePromoterFreeTickets(
    @Param('id', ParseIdPipe) id: string,
    @Param('staffId', ParseIdPipe) staffId: string,
    @Body() body: UpdatePromoterFreeTicketsDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.updatePromoterFreeTickets(
      id,
      userId,
      staffId,
      body.freeTicketLimit,
    );
  }

  // After the fixed organizer/* routes so it doesn't swallow them.
  @UseGuards(JwtAuthGuard)
  @Get('organizer/:id')
  findOneForTeam(
    @Param('id', ParseIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.findOneForTeam(id, userId);
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

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  update(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: UpdateEventDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.update(id, userId, body);
  }

  // The organizer deletes their event; a NeoPass admin takes down any event.
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: DeleteEventDto,
    @CurrentUser() user: { userId: string; role: UserRole },
  ) {
    return this.eventsService.remove(id, user, body.contactEmail);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/batches')
  updateBatches(
    @Param('id', ParseIdPipe) eventId: string,
    @Body() body: UpdateBatchesDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.updateBatches(eventId, userId, body.batches);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/batches/:batchId/sale')
  changeBatchSale(
    @Param('id', ParseIdPipe) eventId: string,
    @Param('batchId', ParseIdPipe) batchId: string,
    @Body() body: BatchSaleActionDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.changeBatchSale(
      eventId,
      userId,
      batchId,
      body.action,
    );
  }

  // --- STAFF ENDPOINTS ---

  @UseGuards(JwtAuthGuard)
  @Get('staff/me')
  getMyStaff(@CurrentUser('userId') userId: string) {
    return this.eventsService.getMyStaff(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('promoter/me/:eventId/stats')
  getPromoterEventStats(
    @Param('eventId', ParseIdPipe) eventId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.getPromoterEventStats(userId, eventId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/staff')
  addStaff(
    @Param('id', ParseIdPipe) eventId: string,
    @Body() body: AddStaffDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.eventsService.addStaff(eventId, userId, body);
  }

  @UseGuards(JwtAuthGuard)
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
