import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserThrottlerGuard } from '../common/throttling';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TicketsService } from './tickets.service';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { CheckInDto } from './dto/check-in.dto';
import { ParseIdPipe } from '../common/parse-id.pipe';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets')
  async getMyTickets(@CurrentUser('userId') userId: string) {
    return this.ticketsService.findMyTickets(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets/locked')
  async getMyLockedTickets(@CurrentUser('userId') userId: string) {
    return this.ticketsService.countLockedFreeTickets(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transfer')
  async transferTicket(
    @Param('id', ParseIdPipe) id: string,
    @Body() body: TransferTicketDto,
    @CurrentUser('userId') userId: string,
  ) {
    await this.ticketsService.transferTicket(id, userId, body.targetUserId);
    return { success: true, message: 'Entrada transferida con éxito' };
  }

  // Per scanner, not per IP: every scanner of a door shares the venue's WiFi.
  // One phone checks at most about one code a second.
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard, RolesGuard, UserThrottlerGuard)
  // Permite a todos, porque la seguridad real se valida por EventStaff en la lógica
  @Roles('ORGANIZER', 'ADMIN', 'CUSTOMER')
  @Post('check-in')
  async checkIn(
    @Body() body: CheckInDto,
    @CurrentUser('userId') scannerId: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.ticketsService.processCheckIn(
      body.qrCode,
      scannerId,
      userAgent,
    );
  }
}
