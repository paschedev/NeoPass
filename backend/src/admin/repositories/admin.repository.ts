import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ORGANIZER_NAME_SELECT } from '../../common/organizer-name';
import { PrismaService } from '../../prisma/prisma.service';

// What ADMIN sees of every event: no organizer data beyond name and email.
// The ids only say who deleted it; the service doesn't pass them on.
const ADMIN_EVENT_SELECT = {
  id: true,
  title: true,
  status: true,
  startDate: true,
  endDate: true,
  deletedAt: true,
  deletedById: true,
  organizerId: true,
  neoPassFeePercentage: true,
  organizer: { select: { name: true, email: true } },
} satisfies Prisma.EventSelect;

const PERSON_SELECT = { name: true, email: true } satisfies Prisma.UserSelect;

// What support needs to know about a ticket. Never its qrCode: that is what
// gets people in. The user ids only say whether it changed hands.
const ADMIN_TICKET_SELECT = {
  id: true,
  status: true,
  usedAt: true,
  userId: true,
  user: { select: PERSON_SELECT },
  ticketType: {
    select: {
      name: true,
      batch: { select: { name: true } },
      event: {
        select: {
          id: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          deletedAt: true,
        },
      },
    },
  },
  order: {
    select: {
      createdAt: true,
      totalAmount: true,
      userId: true,
      user: { select: PERSON_SELECT },
      promoter: { select: { user: { select: { name: true } } } },
    },
  },
  freeTicketGrant: {
    select: {
      recipientEmail: true,
      recipientName: true,
      validUntil: true,
      issuedBy: { select: { name: true } },
    },
  },
} satisfies Prisma.TicketSelect;

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findEvents({
    search,
    skip,
    take,
  }: {
    search?: string;
    skip: number;
    take: number;
  }) {
    const where: Prisma.EventWhereInput = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { organizer: { email: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        select: ADMIN_EVENT_SELECT,
        orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.event.count({ where }),
    ]);
    return { items, total };
  }

  // Tickets sold over capacity, and what paid orders brought in, per event,
  // for a whole page at once. Revenue is what buyers paid for the tickets
  // (the price at purchase, as the organizer sees it); the service fee is
  // counted once per order, however many ticket types it has.
  async sumSalesByEvent(eventIds: string[]) {
    const sales = {
      tickets: new Map<string, { sold: number; capacity: number }>(),
      money: new Map<
        string,
        { revenue: Prisma.Decimal; serviceFee: Prisma.Decimal }
      >(),
    };
    if (eventIds.length === 0) return sales;

    const [ticketRows, moneyRows] = await Promise.all([
      this.prisma.ticketType.groupBy({
        by: ['eventId'],
        where: { eventId: { in: eventIds } },
        _sum: { sold: true, stock: true },
      }),
      this.prisma.$queryRaw<
        {
          eventId: string;
          revenue: Prisma.Decimal;
          serviceFee: Prisma.Decimal;
        }[]
      >`
        SELECT paid."eventId", SUM(paid.revenue) AS revenue,
          SUM(o."serviceFee") AS "serviceFee"
        FROM (
          SELECT oi."orderId", tt."eventId",
            SUM(oi."unitPrice" * oi.quantity) AS revenue
          FROM "OrderItem" oi
          JOIN "TicketType" tt ON tt.id = oi."ticketTypeId"
          WHERE tt."eventId" IN (${Prisma.join(eventIds)})
          GROUP BY oi."orderId", tt."eventId"
        ) paid
        JOIN "Order" o ON o.id = paid."orderId"
        WHERE o.status = 'PAID'
        GROUP BY paid."eventId"`,
    ]);
    for (const row of ticketRows) {
      sales.tickets.set(row.eventId, {
        sold: row._sum.sold ?? 0,
        capacity: row._sum.stock ?? 0,
      });
    }
    for (const { eventId, revenue, serviceFee } of moneyRows) {
      sales.money.set(eventId, { revenue, serviceFee });
    }
    return sales;
  }

  findEventPhase(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      select: { status: true, startDate: true, endDate: true, deletedAt: true },
    });
  }

  findEventForRestore(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        organizerId: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });
  }

  // Only a deleted event comes back, and only once: of two restores at the
  // same time, one finds it already restored.
  async restoreEvent(id: string) {
    const { count } = await this.prisma.event.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null, deletedById: null, deletionContactEmail: null },
    });
    return count === 1;
  }

  // `search` is the code printed on the PDF (the start of the id) or part of
  // the email of whoever has the ticket, bought it or got it as a free one.
  // Both are ILIKE scans, without an index: fine for today's volume.
  async findTickets({
    search,
    skip,
    take,
  }: {
    search?: string;
    skip: number;
    take: number;
  }) {
    const email = { contains: search, mode: 'insensitive' } as const;
    const where: Prisma.TicketWhereInput = search
      ? {
          OR: [
            { id: { startsWith: search, mode: 'insensitive' } },
            { user: { email } },
            { order: { user: { email } } },
            { freeTicketGrant: { recipientEmail: email } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({
        where,
        select: ADMIN_TICKET_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take,
      }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items, total };
  }

  // Everything its mail needs, QR included, to send it again as it is.
  findTicketForResend(id: string) {
    return this.prisma.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        qrCode: true,
        status: true,
        user: { select: PERSON_SELECT },
        ticketType: {
          select: {
            name: true,
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
                organizer: { select: ORGANIZER_NAME_SELECT },
              },
            },
          },
        },
        freeTicketGrant: {
          select: {
            recipientEmail: true,
            recipientName: true,
            validUntil: true,
          },
        },
      },
    });
  }

  updateServiceFee(id: string, percentage: number) {
    return this.prisma.event.update({
      where: { id },
      data: { neoPassFeePercentage: percentage },
      select: { id: true, neoPassFeePercentage: true },
    });
  }
}
