import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StaffRole } from '@prisma/client';
import { BatchChanges } from '../batch-changes';

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
        // Hidden batches never leave the database on the public endpoint.
        ticketBatches: {
          where: { isVisible: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            isVisible: true,
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

  async updateBatchesTransaction(eventId: string, changes: BatchChanges) {
    return this.prisma.$transaction(async (tx) => {
      await this.applyBatchChanges(tx, eventId, changes);
      return tx.event.findUnique({
        where: { id: eventId },
        include: { ticketBatches: { include: { ticketTypes: true } } },
      });
    });
  }

  // Event fields and batches in one transaction: a failed batch leaves the
  // event as it was, instead of half edited.
  async updateWithBatches(
    id: string,
    data: Prisma.EventUpdateInput,
    changes: BatchChanges,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({ where: { id }, data });
      await this.applyBatchChanges(tx, id, changes);
      return event;
    });
  }

  // Ticket types that orders or tickets point to (even expired ones).
  async findTicketTypesInUse(ids: string[]) {
    return this.prisma.ticketType.findMany({
      where: {
        id: { in: ids },
        OR: [{ orderItems: { some: {} } }, { tickets: { some: {} } }],
      },
      select: { id: true, name: true },
    });
  }

  // Event and batches in one transaction: if a batch fails, no half-created
  // event is left behind (and retrying doesn't duplicate it).
  async createWithBatches(
    data: Prisma.EventUncheckedCreateInput,
    changes: BatchChanges,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({ data });
      await this.applyBatchChanges(tx, event.id, changes);
      return event;
    });
  }

  // Every write is scoped to the event, besides the ownership checks the
  // service already made.
  private async applyBatchChanges(
    tx: Prisma.TransactionClient,
    eventId: string,
    { deletedBatchIds, deletedTicketTypeIds, batches }: BatchChanges,
  ) {
    if (deletedBatchIds.length > 0) {
      await tx.ticketType.deleteMany({
        where: { eventId, batchId: { in: deletedBatchIds } },
      });
      await tx.ticketBatch.deleteMany({
        where: { eventId, id: { in: deletedBatchIds } },
      });
    }
    if (deletedTicketTypeIds.length > 0) {
      await tx.ticketType.deleteMany({
        where: { eventId, id: { in: deletedTicketTypeIds } },
      });
    }
    for (const { id, ticketTypes, ...data } of batches) {
      const batch = id
        ? await tx.ticketBatch.update({ where: { id, eventId }, data })
        : await tx.ticketBatch.create({ data: { ...data, eventId } });
      for (const { id: typeId, ...typeData } of ticketTypes) {
        if (typeId) {
          await tx.ticketType.update({
            where: { id: typeId, batchId: batch.id },
            data: typeData,
          });
        } else {
          await tx.ticketType.create({
            data: { ...typeData, eventId, batchId: batch.id },
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

  async findAcceptedPromoterAssignments(userId: string) {
    return this.prisma.eventStaff.findMany({
      where: { userId, role: 'PROMOTER', status: 'ACCEPTED' },
      include: {
        event: { select: { title: true, status: true, startDate: true } },
        orders: {
          where: { status: 'PAID' },
          select: { orderItems: { select: { quantity: true } } },
        },
      },
      orderBy: { event: { startDate: 'desc' } },
    });
  }

  // Only an accepted promoter of this event gets the click. Returns whether it
  // was counted.
  async incrementAcceptedPromoterClicks(eventId: string, staffId: string) {
    const { count } = await this.prisma.eventStaff.updateMany({
      where: { id: staffId, eventId, role: 'PROMOTER', status: 'ACCEPTED' },
      data: { clicks: { increment: 1 } },
    });
    return count > 0;
  }

  async getPromoterStatsForEvent(userId: string, eventId: string) {
    const staff = await this.prisma.eventStaff.findFirst({
      where: { userId, eventId, role: 'PROMOTER', status: 'ACCEPTED' },
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
