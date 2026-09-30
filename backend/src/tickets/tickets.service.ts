import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TicketsRepository } from './repositories/tickets.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // Runs inside the payment transaction: the tickets exist only if it commits.
  async generateTicketsForOrder(orderId: string, tx: Prisma.TransactionClient) {
    const order = await this.ticketsRepository.findOrderWithItems(orderId, tx);

    const ticketData: Prisma.TicketCreateManyInput[] = [];
    for (const item of order.orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        ticketData.push({
          orderId: order.id,
          ticketTypeId: item.ticketTypeId,
          userId: order.userId,
          // Prisma will generate uuid for qrCode and id automatically
        });
      }
    }

    await this.ticketsRepository.createTickets(ticketData, tx);
    this.logger.log(
      `Generated ${ticketData.length} tickets for Order ${order.id}`,
    );
  }

  // Called after the payment commits, never inside its transaction: a payment
  // that rolls back must not send tickets. One mail per order (jobId).
  async queueOrderTicketsEmail(orderId: string) {
    const order = await this.ticketsRepository.findOrderTicketsForMail(orderId);
    if (!order || order.tickets.length === 0) return;

    await this.mailService.queueTicketsEmail(
      {
        to: order.user.email,
        name: order.user.name,
        tickets: order.tickets.map((ticket) => ({
          id: ticket.id,
          qrCode: ticket.qrCode,
          eventName: ticket.ticketType.event.title,
          ticketTypeName: ticket.ticketType.name,
        })),
      },
      `tickets-${orderId}`,
    );
  }

  async findMyTickets(userId: string) {
    return this.ticketsRepository.findMyTickets(userId);
  }

  async processCheckIn(
    qrCode: string,
    scannerId: string,
    userAgent: string | undefined,
  ) {
    const ticket = await this.ticketsRepository.findTicketForValidation(qrCode);

    if (!ticket) {
      return { success: false, status: 'INVALID', message: 'INVÁLIDO' };
    }

    // The organizer of the event, or an accepted scanner or manager of it.
    const event = ticket.ticketType.event;
    if (event.organizerId !== scannerId) {
      const isEventStaff = await this.ticketsRepository.hasAcceptedStaffRole(
        event.id,
        scannerId,
        ['SCANNER', 'MANAGER'],
      );
      if (!isEventStaff) {
        return {
          success: false,
          status: 'WRONG_EVENT',
          message: 'OTRO EVENTO',
        };
      }
    }

    if (event.status === 'CANCELLED' || event.status === 'FINISHED') {
      return {
        success: false,
        status: 'EVENT_CLOSED',
        message: 'EVENTO CERRADO',
      };
    }

    const used = { success: false, status: 'USED', message: 'USADO' };
    if (ticket.status === 'USED') return used;

    if (ticket.status !== 'VALID') {
      return { success: false, status: 'INVALID', message: 'INVÁLIDO' };
    }

    try {
      const checkedIn = await this.ticketsRepository.processCheckInTransaction(
        ticket.id,
        scannerId,
        userAgent,
      );
      if (!checkedIn) return used;
    } catch (error) {
      // A simultaneous scan that got past the status check hits the unique
      // CheckIn.ticketId: for the door it is simply "already used".
      if (isUniqueViolation(error)) return used;
      throw error;
    }

    return {
      success: true,
      status: 'VALID',
      message: 'VÁLIDO',
      event: ticket.ticketType.event.title,
      type: ticket.ticketType.name,
      isGuestList: ticket.isGuestList,
    };
  }

  async transferTicket(
    ticketId: string,
    currentUserId: string,
    targetUserId: string,
  ) {
    const targetUser = await this.ticketsRepository.findUserById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException(
        'El usuario destino no existe. Pedile que se registre primero.',
      );
    }

    if (targetUser.id === currentUserId) {
      throw new BadRequestException(
        'No podés transferirte la entrada a vos mismo.',
      );
    }

    const ticket = await this.ticketsRepository.findTicketWithEvent(ticketId);

    if (!ticket || ticket.userId !== currentUserId) {
      throw new NotFoundException('La entrada no te pertenece o no existe.');
    }

    if (ticket.status !== 'VALID') {
      throw new ConflictException(
        'Solo se pueden transferir entradas válidas.',
      );
    }

    const { event } = ticket.ticketType;
    if (event.status === 'FINISHED' || event.status === 'CANCELLED') {
      throw new ConflictException(
        'No se pueden transferir entradas de un evento finalizado o cancelado.',
      );
    }

    const newQrCode = randomUUID();
    const transferred = await this.ticketsRepository.transferTicket(
      ticketId,
      currentUserId,
      targetUser.id,
      newQrCode,
    );
    if (!transferred) {
      throw new ConflictException(
        'La entrada cambió mientras la transferías. Probá de nuevo.',
      );
    }

    await this.notificationsService.create({
      userId: targetUser.id,
      type: 'SYSTEM',
      title: 'Te transfirieron una entrada',
      message: `Recibiste una entrada para ${event.title}. La encontrás en Mis entradas.`,
      eventId: event.id,
      actionUrl: '/panel/tickets',
    });
    await this.mailService.queueTicketsEmail({
      to: targetUser.email,
      name: targetUser.name,
      tickets: [
        {
          id: ticket.id,
          qrCode: newQrCode,
          eventName: event.title,
          ticketTypeName: ticket.ticketType.name,
        },
      ],
    });
  }
}
