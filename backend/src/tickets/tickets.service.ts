import { randomUUID } from 'node:crypto';
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { TicketsRepository } from './repositories/tickets.repository';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly mailService: MailService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async generateTicketsForOrder(
    orderId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const order = await this.ticketsRepository.findOrderWithItems(orderId, tx);

    if (!order) throw new BadRequestException('Orden no encontrada');

    const ticketData: Prisma.TicketCreateManyInput[] = [];
    for (const item of order.orderItems) {
      for (let i = 0; i < item.quantity; i++) {
        ticketData.push({
          orderId: order.id,
          ticketTypeId: item.ticketType.id,
          userId: order.userId,
          // Prisma will generate uuid for qrCode and id automatically
        });
      }
    }

    await this.ticketsRepository.createTicketsTransaction(
      order.id,
      ticketData,
      tx,
    );
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

  async processCheckIn(qrCode: string, scannerId: string, userAgent: string) {
    const ticket = await this.ticketsRepository.findTicketForValidation(qrCode);

    if (!ticket) {
      return { success: false, status: 'INVALID', message: 'INVÁLIDO' };
    }

    // Validar permisos del Scanner en EventStaff o si es el organizador global
    const event = ticket.ticketType.event;
    if (event.organizerId !== scannerId) {
      const staffPermission = await this.ticketsRepository.findEventStaff(
        event.id,
        scannerId,
        'SCANNER',
      );

      // Intentamos validar también MANAGER por si el frontend no distingue bien
      const managerPermission = await this.ticketsRepository.findEventStaff(
        event.id,
        scannerId,
        'MANAGER',
      );

      if (
        (!staffPermission || staffPermission.status !== 'ACCEPTED') &&
        (!managerPermission || managerPermission.status !== 'ACCEPTED')
      ) {
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
      throw new BadRequestException(
        'El usuario destino no existe. Pídele que se registre primero.',
      );
    }

    if (targetUser.id === currentUserId) {
      throw new BadRequestException(
        'No puedes transferirte la entrada a ti mismo.',
      );
    }

    const ticket = await this.ticketsRepository.findTicketWithEvent(ticketId);

    if (!ticket || ticket.userId !== currentUserId) {
      throw new BadRequestException('La entrada no te pertenece o no existe.');
    }

    if (ticket.status !== 'VALID') {
      throw new BadRequestException(
        'Solo se pueden transferir entradas válidas.',
      );
    }

    const { event } = ticket.ticketType;
    if (event.status === 'FINISHED' || event.status === 'CANCELLED') {
      throw new BadRequestException(
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
      throw new BadRequestException(
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

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
