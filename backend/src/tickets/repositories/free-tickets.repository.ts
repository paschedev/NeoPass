import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const GRANT_SELECT = {
  id: true,
  recipientEmail: true,
  recipientName: true,
  validUntil: true,
  createdAt: true,
  lastSentAt: true,
  cancelledAt: true,
  ticketType: { select: { id: true, name: true } },
  tickets: { select: { status: true } },
  issuedBy: { select: { name: true } },
} as const;

// A big event can have many grants, but the list is not endless.
const MAX_GRANTS_LISTED = 500;

// The grants of an event, or only the ones one person sent.
const grantsWhere = (eventId: string, issuedById?: string) => ({
  eventId,
  ...(issuedById && { issuedById }),
});

@Injectable()
export class FreeTicketsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Who can see it was already checked by EventAccessService.
  async findEvent(eventId: string) {
    return this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        status: true,
        startDate: true,
        endDate: true,
        venueName: true,
        venueAddress: true,
        venueCity: true,
        organizer: { select: { name: true } },
      },
    });
  }

  async findEventTicketType(eventId: string, ticketTypeId: string) {
    return this.prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
      select: { id: true },
    });
  }

  async countGrantsIssuedSince(issuedById: string, since: Date) {
    return this.prisma.freeTicketGrant.count({
      where: { issuedById, createdAt: { gte: since } },
    });
  }

  // The grant and its tickets, all or nothing. Free tickets do not touch the
  // stock and belong to no account. With a quota (a co-organizer's limit),
  // their staff row stays locked while their tickets are counted, so two sends
  // at the same time can't both fit; over the limit nothing is created.
  async createGrant(
    {
      quantity,
      ...data
    }: {
      eventId: string;
      ticketTypeId: string;
      issuedById: string;
      recipientEmail: string;
      recipientName: string | null;
      validUntil: Date | null;
      quantity: number;
    },
    quota: { coOrganizerId: string; limit: number } | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (quota) {
        await tx.$queryRaw`
          SELECT id FROM "EventStaff" WHERE id = ${quota.coOrganizerId} FOR UPDATE`;
        const sent = await tx.ticket.count({
          where: {
            status: { not: 'CANCELLED' },
            freeTicketGrant: grantsWhere(data.eventId, data.issuedById),
          },
        });
        if (sent + quantity > quota.limit) {
          return { overLimit: true as const, sent };
        }
      }
      const { id } = await tx.freeTicketGrant.create({
        data,
        select: { id: true },
      });
      await tx.ticket.createMany({
        data: Array.from({ length: quantity }, () => ({
          ticketTypeId: data.ticketTypeId,
          isGuestList: true,
          freeTicketGrantId: id,
        })),
      });
      const grant = await tx.freeTicketGrant.findUniqueOrThrow({
        where: { id },
        select: GRANT_SELECT,
      });
      return { overLimit: false as const, grant };
    });
  }

  async findGrants(eventId: string, issuedById?: string) {
    return this.prisma.freeTicketGrant.findMany({
      where: grantsWhere(eventId, issuedById),
      orderBy: { createdAt: 'desc' },
      take: MAX_GRANTS_LISTED,
      select: GRANT_SELECT,
    });
  }

  async findGrant(eventId: string, grantId: string, issuedById?: string) {
    return this.prisma.freeTicketGrant.findFirst({
      where: { id: grantId, ...grantsWhere(eventId, issuedById) },
      select: GRANT_SELECT,
    });
  }

  // The tickets that can still be used, with what the mail needs.
  async findUsableGrantTickets(grantId: string) {
    return this.prisma.ticket.findMany({
      where: { freeTicketGrantId: grantId, status: 'VALID' },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        qrCode: true,
        ticketType: { select: { name: true } },
      },
    });
  }

  // Conditional on the grant not being cancelled yet, and each ticket on still
  // being VALID: a ticket scanned at the same time stays USED.
  async cancelGrant(grantId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.freeTicketGrant.updateMany({
        where: { id: grantId, cancelledAt: null },
        data: { cancelledAt: now },
      });
      if (count === 0) return false;
      await tx.ticket.updateMany({
        where: { freeTicketGrantId: grantId, status: 'VALID' },
        data: { status: 'CANCELLED' },
      });
      return true;
    });
  }

  // Only if it was not cancelled and the last send is old enough.
  async markResent(grantId: string, now: Date, sentBefore: Date) {
    const { count } = await this.prisma.freeTicketGrant.updateMany({
      where: {
        id: grantId,
        cancelledAt: null,
        lastSentAt: { lte: sentBefore },
      },
      data: { lastSentAt: now },
    });
    return count > 0;
  }
}
