import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { TicketsService } from './tickets.service';
import { TransferTicketDto } from './dto/transfer-ticket.dto';
import { CheckInDto } from './dto/check-in.dto';

@Controller('tickets')
export class TicketsController {
  constructor(private ticketsService: TicketsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my-tickets')
  async getMyTickets(@Req() req: any) {
    return this.ticketsService.findMyTickets(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/transfer')
  async transferTicket(
    @Param('id') id: string,
    @Body() body: TransferTicketDto,
    @Req() req: any,
  ) {
    try {
      await this.ticketsService.transferTicket(
        id,
        req.user.userId,
        body.targetUserId,
      );
      return { success: true, message: 'Entrada transferida con éxito' };
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  // Permite a todos, porque la seguridad real se valida por EventStaff en la lógica
  @Roles('ORGANIZER', 'ADMIN', 'CUSTOMER')
  @Post('check-in')
  async checkIn(@Body() body: CheckInDto, @Req() req: any) {
    const scannerId = req.user.userId;
    const userAgent = req.headers['user-agent'] || 'Unknown Device';

    return this.ticketsService.processCheckIn(
      body.qrCode,
      scannerId,
      userAgent,
    );
  }
}
