import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StaffRole, CommissionType } from '@prisma/client';

// Public = published and not over yet.
function publicEventWhere(now: Date): Prisma.EventWhereInput {
  return { status: 'PUBLISHED', endDate: { gt: now } };
}

@Injectable()
export class EventsRepository {
  constructor(private prisma: PrismaService) {}

  async findPublicPage(now: Date, skip: number, take: number) {
    const where = publicEventWhere(now);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        orderBy: { startDate: 'asc' },
        skip,
        take,
        select: {
          id: true,
          title: true,
          imageUrl: true,
          startDate: true,
          endDate: true,
          venueName: true,
          venueAddress: true,
        },
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total };
  }

  async findPublicById(id: string, now: Date) {
    return this.prisma.event.findFirst({
      where: { id, ...publicEventWhere(now) },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        youtubeLink: true,
        startDate: true,
        endDate: true,
        venueName: true,
        venueAddress: true,
        status: true,
        neoPassFeePercentage: true,
        ticketBatches: {
          select: {
            id: true,
            name: true,
            status: true,
            publishAt: true,
            closeAt: true,
            ticketTypes: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                sold: true,
                reserved: true,
              },
            },
          },
        },
      },
    });
  }

  async isPublicEvent(id: string, now: Date) {
    const count = await this.prisma.event.count({
      where: { id, ...publicEventWhere(now) },
    });
    return count > 0;
  }

  async finishPublishedEventsEndedBefore(now: Date) {
    return this.prisma.event.updateMany({
      where: { status: 'PUBLISHED', endDate: { lte: now } },
      data: { status: 'FINISHED' },
    });
  }

  async findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketBatches: { include: { ticketTypes: true } },
        ticketTypes: true,
      },
    });
  }

  async update(id: string, data: Prisma.EventUpdateInput) {
    return this.prisma.event.update({
      where: { id },
      data,
    });
  }

  async findByOrganizer(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      include: {
        ticketBatches: { include: { ticketTypes: true } },
        ticketTypes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBatchesTransaction(
    eventId: string,
    batchesData: any[],
    eventContext: any,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.applyBatches(tx, eventId, batchesData, eventContext);
      return tx.event.findUnique({
        where: { id: eventId },
        include: { ticketBatches: { include: { ticketTypes: true } } },
      });
    });
  }

  // Event and batches in one transaction: if a batch fails, no half-created
  // event is left behind (and retrying doesn't duplicate it).
  async createWithBatches(
    data: Prisma.EventUncheckedCreateInput,
    batchesData: any[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({ data });
      await this.applyBatches(tx, event.id, batchesData, { ticketBatches: [] });
      return event;
    });
  }

  private async applyBatches(
    tx: Prisma.TransactionClient,
    eventId: string,
    batchesData: any[],
    eventContext: any,
  ) {
    const incomingBatchIds = batchesData.filter((b) => b.id).map((b) => b.id);

    const batchesToDelete = eventContext.ticketBatches.filter(
      (b: any) => !incomingBatchIds.includes(b.id),
    );
    for (const b of batchesToDelete) {
      const totalSold = b.ticketTypes.reduce(
        (acc: number, tt: any) => acc + tt.sold,
        0,
      );
      if (totalSold > 0) {
        throw new BadRequestException(
          `No puedes eliminar la tanda "${b.name}" porque ya tiene entradas vendidas. Pausa su venta en su lugar.`,
        );
      }
      await tx.ticketType.deleteMany({ where: { batchId: b.id } });
      await tx.ticketBatch.delete({ where: { id: b.id } });
    }
    for (const batch of batchesData) {
      let status = batch.status || 'DRAFT';
      if (
        batch.publishAt &&
        new Date(batch.publishAt) > new Date() &&
        status !== 'DRAFT'
      ) {
        status = 'SCHEDULED';
      }

      let savedBatch;
      if (batch.id) {
        savedBatch = await tx.ticketBatch.update({
          where: { id: batch.id, eventId },
          data: {
            name: batch.name,
            status: status,
            publishAt: batch.publishAt ? new Date(batch.publishAt) : null,
            closeAt: batch.closeAt ? new Date(batch.closeAt) : null,
            publishWhenPreviousSoldOut:
              batch.publishWhenPreviousSoldOut || false,
          },
        });
      } else {
        savedBatch = await tx.ticketBatch.create({
          data: {
            eventId,
            name: batch.name,
            status: status,
            publishAt: batch.publishAt ? new Date(batch.publishAt) : null,
            closeAt: batch.closeAt ? new Date(batch.closeAt) : null,
            publishWhenPreviousSoldOut:
              batch.publishWhenPreviousSoldOut || false,
          },
        });
      }

      const incomingTypeIds = batch.ticketTypes
        .filter((t: any) => t.id)
        .map((t: any) => t.id);
      const existingTypes = batch.id
        ? eventContext.ticketBatches.find((b: any) => b.id === batch.id)
            ?.ticketTypes || []
        : [];
      const typesToDelete = existingTypes.filter(
        (t: any) => !incomingTypeIds.includes(t.id),
      );

      for (const t of typesToDelete) {
        if (t.sold > 0) {
          throw new BadRequestException(
            `No puedes eliminar el ticket "${t.name}" porque ya tiene ventas. Pon su stock en 0 en su lugar.`,
          );
        }
        await tx.ticketType.delete({ where: { id: t.id } });
      }

      for (const tType of batch.ticketTypes) {
        if (tType.id) {
          await tx.ticketType.update({
            where: { id: tType.id, batchId: savedBatch.id },
            data: {
              name: tType.name,
              price: tType.price,
              stock: tType.stock,
              saleStart: savedBatch.publishAt || new Date(),
              saleEnd: savedBatch.closeAt || new Date(Date.now() + 31536000000),
            },
          });
        } else {
          await tx.ticketType.create({
            data: {
              eventId,
              batchId: savedBatch.id,
              name: tType.name,
              price: tType.price,
              stock: tType.stock,
              saleStart: savedBatch.publishAt || new Date(),
              saleEnd: savedBatch.closeAt || new Date(Date.now() + 31536000000),
            },
          });
        }
      }
    }
  }

  async getOrganizerEventsWithTickets(userId: string) {
    return this.prisma.event.findMany({
      where: { organizerId: userId },
      include: {
        ticketTypes: true,
      },
    });
  }

  async getPaidOrdersForEvents(eventIds: string[], fromDate: Date) {
    return this.prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: { gte: fromDate },
        orderItems: {
          some: {
            ticketType: {
              eventId: { in: eventIds },
            },
          },
        },
      },
      include: {
        orderItems: {
          include: {
            ticketType: {
              include: {
                event: { select: { title: true } },
              },
            },
          },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrganizerStaff(organizerId: string) {
    return this.prisma.eventStaff.findMany({
      where: {
        event: {
          organizerId,
        },
      },
      include: {
        user: {
          select: { name: true, email: true },
        },
        event: {
          select: { title: true },
        },
      },
      orderBy: {
        event: { title: 'asc' },
      },
    });
  }

  async findEventStaff(eventId: string, userId: string, role: StaffRole) {
    return this.prisma.eventStaff.findUnique({
      where: { eventId_userId_role: { eventId, userId, role } },
    });
  }

  async findEventStaffById(id: string) {
    return this.prisma.eventStaff.findUnique({
      where: { id },
      include: {
        event: true,
        user: true,
      },
    });
  }

  async createEventStaff(data: Prisma.EventStaffCreateInput) {
    return this.prisma.eventStaff.create({ data });
  }

  async updateEventStaff(id: string, data: Prisma.EventStaffUpdateInput) {
    return this.prisma.eventStaff.update({
      where: { id },
      data,
    });
  }

  async getEventStaffByEvent(eventId: string) {
    return this.prisma.eventStaff.findMany({
      where: { eventId },
      include: { user: { select: { name: true, email: true } } },
    });
  }

  async getPromoterStats(userId: string) {
    const staffList = await this.prisma.eventStaff.findMany({
      where: { userId, role: 'PROMOTER' },
      include: {
        event: { select: { title: true, status: true, startDate: true } },
        orders: {
          where: { status: 'PAID' },
          include: { orderItems: true },
        },
      },
      orderBy: { event: { startDate: 'desc' } },
    });

    return staffList.map((staff) => {
      const totalTicketsSold = staff.orders.reduce((acc, order) => {
        return (
          acc + order.orderItems.reduce((sum, item) => sum + item.quantity, 0)
        );
      }, 0);
      const { orders, ...rest } = staff;
      return {
        ...rest,
        totalTicketsSold,
      };
    });
  }

  async incrementPromoterClicks(staffId: string) {
    return this.prisma.eventStaff.update({
      where: { id: staffId },
      data: { clicks: { increment: 1 } },
    });
  }

  async getPromoterStatsForEvent(userId: string, eventId: string) {
    const staff = await this.prisma.eventStaff.findFirst({
      where: { userId, eventId, role: 'PROMOTER' },
      include: {
        event: { select: { title: true } },
        orders: {
          where: { status: 'PAID' },
          include: {
            orderItems: { include: { ticketType: true } },
            user: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return staff;
  }
}
