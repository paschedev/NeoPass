import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StaffRole } from '@prisma/client';

@Injectable()
export class TicketsRepository {
  constructor(private prisma: PrismaService) {}

  async findOrderWithItems(orderId: string, tx: Prisma.TransactionClient) {
    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        orderItems: { select: { ticketTypeId: true, quantity: true } },
      },
    });
  }

  async createTickets(
    ticketData: Prisma.TicketCreateManyInput[],
    tx: Prisma.TransactionClient,
  ) {
    return tx.ticket.createMany({ data: ticketData });
  }

  async findMyTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      include: {
        ticketType: {
          include: {
            event: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findTicketForValidation(qrCode: string) {
    return this.prisma.ticket.findUnique({
      where: { qrCode },
      select: {
        id: true,
        status: true,
        isGuestList: true,
        ticketType: {
          select: {
            name: true,
            event: {
              select: {
                id: true,
                organizerId: true,
                status: true,
                title: true,
              },
            },
          },
        },
      },
    });
  }

  async findTicketWithEvent(ticketId: string) {
    return this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        ticketType: {
          select: {
            name: true,
            event: { select: { id: true, title: true, status: true } },
          },
        },
      },
    });
  }

  async findOrderTicketsForMail(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        user: { select: { email: true, name: true } },
        tickets: {
          select: {
            id: true,
            qrCode: true,
            ticketType: {
              select: { name: true, event: { select: { title: true } } },
            },
          },
        },
      },
    });
  }

  async processCheckInTransaction(
    ticketId: string,
    scannerId: string,
    userAgent: string | undefined,
  ) {
    // Conditional on VALID: of two simultaneous scans only one marks the
    // ticket as used. Returns false if it was already used.
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.ticket.updateMany({
        where: { id: ticketId, status: 'VALID' },
        data: { status: 'USED', usedAt: new Date() },
      });
      if (count === 0) return false;

      await tx.checkIn.create({
        data: {
          ticketId: ticketId,
          scannerId: scannerId,
          deviceInfo: userAgent || 'Unknown Device',
        },
      });
      return true;
    });
  }

  async hasAcceptedStaffRole(
    eventId: string,
    userId: string,
    roles: StaffRole[],
  ) {
    const staff = await this.prisma.eventStaff.findFirst({
      where: { eventId, userId, role: { in: roles }, status: 'ACCEPTED' },
      select: { id: true },
    });
    return staff !== null;
  }

  // Moves a still-valid ticket to its new owner with a fresh QR, so the one the
  // previous owner has (mail, screenshots) stops working. Conditional on owner
  // and status: returns false if the ticket changed in the meantime.
  async transferTicket(
    ticketId: string,
    currentUserId: string,
    newUserId: string,
    newQrCode: string,
  ) {
    const { count } = await this.prisma.ticket.updateMany({
      where: { id: ticketId, userId: currentUserId, status: 'VALID' },
      data: { userId: newUserId, qrCode: newQrCode },
    });
    return count === 1;
  }

  async findUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true },
    });
  }
}
