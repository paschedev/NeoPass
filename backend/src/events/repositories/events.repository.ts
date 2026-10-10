import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StaffRole, StaffStatus } from '@prisma/client';
import { BatchChanges } from '../batch-changes';
import { ActivityEntry } from '../event-activity';
import { ORGANIZER_NAME_SELECT } from '../../common/organizer-name';

export type InvitationAnswer = Extract<StaffStatus, 'ACCEPTED' | 'REJECTED'>;

// Who holds each ticket now (after transfers) and how it is going; never the
// QR code, which is the ticket itself.
const ATTENDEE_SELECT = {
  id: true,
  status: true,
  usedAt: true,
  user: { select: { name: true } },
  freeTicketGrant: { select: { recipientName: true } },
  ticketType: { select: { name: true, batch: { select: { name: true } } } },
} satisfies Prisma.TicketSelect;

const ATTENDEE_ORDER: Prisma.TicketOrderByWithRelationInput[] = [
  { user: { name: 'asc' } },
  { createdAt: 'asc' },
];

const PAYMENT_HISTORY = {
  orderBy: { createdAt: 'desc' },
  select: { amount: true, note: true, createdAt: true },
} satisfies Prisma.EventStaff$paymentsArgs;

// Public = published, not deleted and not over yet.
function publicEventWhere(now: Date): Prisma.EventWhereInput {
  return { status: 'PUBLISHED', deletedAt: null, endDate: { gt: now } };
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
        venueCity: true,
        latitude: true,
        longitude: true,
        venuePlaceId: true,
        status: true,
        neoPassFeePercentage: true,
        organizer: { select: ORGANIZER_NAME_SELECT },
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

  async findForDeletion(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        organizerId: true,
        organizer: { select: { email: true } },
      },
    });
  }

  // Conditional on not being deleted yet: of two deletions at the same time
  // only one counts.
  async markDeleted(
    id: string,
    data: {
      deletedAt: Date;
      deletedById: string;
      deletionContactEmail: string;
    },
  ) {
    const { count } = await this.prisma.event.updateMany({
      where: { id, deletedAt: null },
      data,
    });
    return count > 0;
  }

  async findOne(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        ticketBatches: {
          orderBy: { createdAt: 'asc' },
          include: { ticketTypes: true },
        },
        ticketTypes: true,
      },
    });
  }

  // The event and what changed in its history, all or nothing.
  async update(
    id: string,
    data: Prisma.EventUpdateInput,
    activity: ActivityEntry[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({ where: { id }, data });
      await tx.eventActivity.createMany({ data: activity });
      return event;
    });
  }

  async findByOrganizer(organizerId: string) {
    return this.prisma.event.findMany({
      where: { organizerId },
      include: {
        ticketBatches: {
          orderBy: { createdAt: 'asc' },
          include: { ticketTypes: true },
        },
        ticketTypes: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateBatchesTransaction(
    eventId: string,
    changes: BatchChanges,
    activity: ActivityEntry[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.applyBatchChanges(tx, eventId, changes);
      await tx.eventActivity.createMany({ data: activity });
      return tx.event.findUnique({
        where: { id: eventId },
        include: { ticketBatches: { include: { ticketTypes: true } } },
      });
    });
  }

  async updateBatchSale(
    eventId: string,
    batchId: string,
    data: Pick<
      Prisma.TicketBatchUpdateInput,
      'isVisible' | 'publishAt' | 'closeAt'
    >,
    activity: ActivityEntry,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.ticketBatch.update({
        where: { id: batchId, eventId },
        data,
        select: { id: true, isVisible: true, publishAt: true, closeAt: true },
      });
      await tx.eventActivity.create({ data: activity });
      return batch;
    });
  }

  // Event fields, batches and history in one transaction: a failed batch
  // leaves the event as it was, instead of half edited.
  async updateWithBatches(
    id: string,
    data: Prisma.EventUpdateInput,
    changes: BatchChanges,
    activity: ActivityEntry[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({ where: { id }, data });
      await this.applyBatchChanges(tx, id, changes);
      await tx.eventActivity.createMany({ data: activity });
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

  // What buyers paid for each ticket type of the event, by paid order: the
  // price at purchase, not the current one.
  async sumPaidRevenueByTicketType(eventId: string) {
    const rows = await this.prisma.$queryRaw<
      { ticketTypeId: string; revenue: Prisma.Decimal }[]
    >`
      SELECT oi."ticketTypeId", SUM(oi."unitPrice" * oi.quantity) AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "TicketType" tt ON tt.id = oi."ticketTypeId"
      WHERE o.status = 'PAID' AND tt."eventId" = ${eventId}
      GROUP BY oi."ticketTypeId"`;
    return new Map(rows.map((row) => [row.ticketTypeId, row.revenue]));
  }

  // The same, per event, for every event of the organizer.
  async sumPaidRevenueByEvent(organizerId: string) {
    const rows = await this.prisma.$queryRaw<
      { eventId: string; revenue: Prisma.Decimal }[]
    >`
      SELECT tt."eventId", SUM(oi."unitPrice" * oi.quantity) AS revenue
      FROM "OrderItem" oi
      JOIN "Order" o ON o.id = oi."orderId"
      JOIN "TicketType" tt ON tt.id = oi."ticketTypeId"
      JOIN "Event" e ON e.id = tt."eventId"
      WHERE o.status = 'PAID' AND e."organizerId" = ${organizerId}
      GROUP BY tt."eventId"`;
    return new Map(rows.map((row) => [row.eventId, row.revenue]));
  }

  async countCheckedInTickets(eventId: string) {
    return this.prisma.ticket.count({
      where: { status: 'USED', ticketType: { eventId } },
    });
  }

  // Orders whose approved payment was later refunded or charged back.
  async countRefundedOrders(eventId: string) {
    return this.prisma.order.count({
      where: {
        status: 'CANCELLED',
        payment: { status: 'REFUNDED' },
        orderItems: { some: { ticketType: { eventId } } },
      },
    });
  }

  // Face value of the tickets of every paid order of the organizer's events,
  // as charged: a later price change doesn't rewrite it.
  async sumPaidTicketAmountForOrganizer(organizerId: string) {
    const { _sum } = await this.prisma.order.aggregate({
      where: {
        status: 'PAID',
        orderItems: { some: { ticketType: { event: { organizerId } } } },
      },
      _sum: { ticketAmount: true },
    });
    return _sum.ticketAmount ?? new Prisma.Decimal(0);
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

  // The organizer's events for the staff tab: the ones that had staff and the
  // ones not over yet (they may still need it), with every member and the
  // payments recorded to its promoters.
  async findStaffOverviewEvents(organizerId: string, now: Date) {
    return this.prisma.event.findMany({
      where: {
        organizerId,
        OR: [
          { staff: { some: {} } },
          {
            endDate: { gt: now },
            status: { notIn: ['FINISHED', 'CANCELLED'] },
            deletedAt: null,
          },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        deletedAt: true,
        staff: {
          select: {
            id: true,
            userId: true,
            role: true,
            status: true,
            commissionType: true,
            commissionValue: true,
            totalEarned: true,
            totalPaid: true,
            permissions: true,
            freeTicketLimit: true,
            user: { select: { name: true, email: true } },
            payments: PAYMENT_HISTORY,
          },
        },
      },
    });
  }

  // Tickets each promoter sold with paid orders: the promoters of an
  // organizer's events, or the promoter roles of one person.
  async sumTicketsSoldByPromoter(
    scope: { organizerId: string } | { userId: string },
  ) {
    const owner =
      'organizerId' in scope
        ? Prisma.sql`e."organizerId" = ${scope.organizerId}`
        : Prisma.sql`es."userId" = ${scope.userId}`;
    const rows = await this.prisma.$queryRaw<
      { promoterId: string; sold: number }[]
    >`
      SELECT o."promoterId", SUM(oi.quantity)::int AS sold
      FROM "Order" o
      JOIN "OrderItem" oi ON oi."orderId" = o.id
      JOIN "EventStaff" es ON es.id = o."promoterId"
      JOIN "Event" e ON e.id = es."eventId"
      WHERE o.status = 'PAID' AND ${owner}
      GROUP BY o."promoterId"`;
    return new Map(rows.map((row) => [row.promoterId, row.sold]));
  }

  // Free tickets each promoter sent in their event and not cancelled, what
  // counts for their limit: the promoters of an organizer's events, or the
  // promoter roles of one person.
  async countFreeTicketsSentByPromoter(
    scope: { organizerId: string } | { userId: string },
  ) {
    const owner =
      'organizerId' in scope
        ? Prisma.sql`e."organizerId" = ${scope.organizerId}`
        : Prisma.sql`es."userId" = ${scope.userId}`;
    const rows = await this.prisma.$queryRaw<
      { promoterId: string; sent: number }[]
    >`
      SELECT es.id AS "promoterId", COUNT(t.id)::int AS sent
      FROM "EventStaff" es
      JOIN "Event" e ON e.id = es."eventId"
      JOIN "FreeTicketGrant" g
        ON g."eventId" = es."eventId" AND g."issuedById" = es."userId"
      JOIN "Ticket" t ON t."freeTicketGrantId" = g.id
      WHERE es.role = 'PROMOTER' AND t.status <> 'CANCELLED' AND ${owner}
      GROUP BY es.id`;
    return new Map(rows.map((row) => [row.promoterId, row.sent]));
  }

  // A person's accepted and pending staff roles with the event they belong
  // to. Only the organizer's name: never their email or payment data.
  async findMyStaffAssignments(userId: string) {
    return this.prisma.eventStaff.findMany({
      where: { userId, status: { in: ['ACCEPTED', 'PENDING'] } },
      select: {
        id: true,
        role: true,
        status: true,
        commissionType: true,
        commissionValue: true,
        totalEarned: true,
        totalPaid: true,
        permissions: true,
        freeTicketLimit: true,
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            deletedAt: true,
            venueName: true,
            venueAddress: true,
            venueCity: true,
            latitude: true,
            longitude: true,
            venuePlaceId: true,
            organizer: { select: ORGANIZER_NAME_SELECT },
          },
        },
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
        event: { select: { id: true, title: true, organizerId: true } },
        user: { select: { name: true } },
      },
    });
  }

  async updateStaffTerms(
    id: string,
    terms: Pick<
      Prisma.EventStaffUncheckedUpdateInput,
      'permissions' | 'freeTicketLimit'
    >,
  ) {
    return this.prisma.eventStaff.update({ where: { id }, data: terms });
  }

  // Returns whether this call answered it: only a pending invitation can be.
  async answerPendingInvitation(id: string, status: InvitationAnswer) {
    const { count } = await this.prisma.eventStaff.updateMany({
      where: { id, status: 'PENDING' },
      data: { status },
    });
    return count > 0;
  }

  // A new invitation, or a new one over the row of someone who rejected it,
  // with its record in the event history: all or nothing.
  async saveStaffInvitation(
    existingId: string | null,
    data: Prisma.EventStaffUncheckedCreateInput,
    activity: ActivityEntry,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const staff = existingId
        ? await tx.eventStaff.update({
            where: { id: existingId },
            data: { ...data, status: 'PENDING' },
          })
        : await tx.eventStaff.create({ data });
      await tx.eventActivity.create({ data: activity });
      return staff;
    });
  }

  async getEventStaffByEvent(eventId: string) {
    return this.prisma.eventStaff.findMany({
      where: { eventId },
      include: { user: { select: { name: true, email: true } } },
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

  // Every batch of the event with its ticket types, hidden ones included: a
  // free ticket can be of any type.
  async findFreeTicketBatches(eventId: string) {
    return this.prisma.ticketBatch.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
      select: {
        name: true,
        ticketTypes: { select: { id: true, name: true } },
      },
    });
  }

  async getPromoterStatsForEvent(userId: string, eventId: string) {
    const staff = await this.prisma.eventStaff.findFirst({
      where: { userId, eventId, role: 'PROMOTER', status: 'ACCEPTED' },
      include: {
        event: {
          select: {
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            deletedAt: true,
          },
        },
        orders: {
          where: { status: 'PAID' },
          include: {
            orderItems: { include: { ticketType: true } },
            user: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        payments: PAYMENT_HISTORY,
      },
    });

    return staff;
  }

  async findEventAttendees(
    eventId: string,
    { search, skip, take }: { search?: string; skip: number; take: number },
  ) {
    const where: Prisma.TicketWhereInput = {
      ticketType: { eventId },
      // Only by name: searching emails the list doesn't show would still
      // tell whether an address has a ticket.
      ...(search && {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          {
            freeTicketGrant: {
              recipientName: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: ATTENDEE_SELECT,
        orderBy: ATTENDEE_ORDER,
        skip,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total };
  }

  async findAllEventAttendees(eventId: string) {
    return this.prisma.ticket.findMany({
      where: { ticketType: { eventId } },
      select: ATTENDEE_SELECT,
      orderBy: ATTENDEE_ORDER,
    });
  }

  async recordActivity(entry: ActivityEntry) {
    await this.prisma.eventActivity.create({ data: entry });
  }

  async countTicketsByTypeAndStatus(eventId: string) {
    const rows = await this.prisma.ticket.groupBy({
      by: ['ticketTypeId', 'status'],
      where: { ticketType: { eventId } },
      _count: { _all: true },
    });
    return rows.map(({ ticketTypeId, status, _count }) => ({
      ticketTypeId,
      status,
      count: _count._all,
    }));
  }

  async findEventTicketTypes(eventId: string) {
    return this.prisma.ticketType.findMany({
      where: { eventId },
      orderBy: [{ batch: { createdAt: 'asc' } }, { name: 'asc' }],
      select: { id: true, name: true, batch: { select: { name: true } } },
    });
  }

  // Promoters of the event with what they sold (paid orders) and the payments
  // the organizer recorded.
  async findEventPromoters(eventId: string) {
    return this.prisma.eventStaff.findMany({
      where: { eventId, role: 'PROMOTER' },
      orderBy: { user: { name: 'asc' } },
      select: {
        id: true,
        status: true,
        commissionType: true,
        commissionValue: true,
        totalEarned: true,
        totalPaid: true,
        user: { select: { name: true, email: true } },
        orders: {
          where: { status: 'PAID' },
          select: {
            ticketAmount: true,
            orderItems: { select: { quantity: true } },
          },
        },
        payments: PAYMENT_HISTORY,
      },
    });
  }

  async findEventPromoterTotals(eventId: string, staffId: string) {
    return this.prisma.eventStaff.findFirst({
      where: { id: staffId, eventId, role: 'PROMOTER' },
      select: {
        totalEarned: true,
        totalPaid: true,
        user: { select: { name: true } },
      },
    });
  }

  // Records the payment only if it fits in what is still owed, in the same
  // transaction that adds it to totalPaid and writes it in the history.
  // Returns null when it doesn't fit, also when another payment recorded at
  // the same time took the balance.
  async registerPromoterPayment(
    {
      eventStaffId,
      amount,
      note,
      registeredById,
    }: {
      eventStaffId: string;
      amount: Prisma.Decimal;
      note: string | null;
      registeredById: string;
    },
    activity: ActivityEntry,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.$executeRaw`
        UPDATE "EventStaff" SET "totalPaid" = "totalPaid" + ${amount.toFixed(2)}::numeric
        WHERE id = ${eventStaffId}
          AND "totalEarned" - "totalPaid" >= ${amount.toFixed(2)}::numeric`;
      if (updated === 0) return null;
      const payment = await tx.promoterPayment.create({
        data: { eventStaffId, amount, note, registeredById },
        select: PAYMENT_HISTORY.select,
      });
      await tx.eventActivity.create({ data: activity });
      const totals = await tx.eventStaff.findUniqueOrThrow({
        where: { id: eventStaffId },
        select: { totalEarned: true, totalPaid: true },
      });
      return { payment, ...totals };
    });
  }
}
