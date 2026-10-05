import { Injectable } from '@nestjs/common';
import { EventPermission, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityEntry } from '../event-activity';

const CO_ORGANIZER_SELECT = {
  id: true,
  status: true,
  permissions: true,
  freeTicketLimit: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.EventStaffSelect;

@Injectable()
export class CoOrganizersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCoOrganizers(eventId: string) {
    return this.prisma.eventStaff.findMany({
      where: { eventId, role: 'MANAGER' },
      select: CO_ORGANIZER_SELECT,
    });
  }

  async findCoOrganizer(eventId: string, staffId: string) {
    return this.prisma.eventStaff.findFirst({
      where: { id: staffId, eventId, role: 'MANAGER' },
      select: CO_ORGANIZER_SELECT,
    });
  }

  // The change and its record in the history (of activity.eventId), all or
  // nothing. Null if the co-organizer was removed in the meantime.
  async updateCoOrganizer(
    staffId: string,
    terms: { permissions: EventPermission[]; freeTicketLimit: number | null },
    activity: ActivityEntry,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.eventStaff.updateMany({
        where: { id: staffId, eventId: activity.eventId, role: 'MANAGER' },
        data: terms,
      });
      if (count === 0) return null;
      await tx.eventActivity.create({ data: activity });
      return tx.eventStaff.findUniqueOrThrow({
        where: { id: staffId },
        select: CO_ORGANIZER_SELECT,
      });
    });
  }

  // Returns whether this call removed it.
  async removeCoOrganizer(staffId: string, activity: ActivityEntry) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.eventStaff.deleteMany({
        where: { id: staffId, eventId: activity.eventId, role: 'MANAGER' },
      });
      if (count === 0) return false;
      await tx.eventActivity.create({ data: activity });
      return true;
    });
  }

  async findActivityPage(eventId: string, skip: number, take: number) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.eventActivity.findMany({
        where: { eventId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take,
        select: {
          id: true,
          type: true,
          summary: true,
          createdAt: true,
          actor: { select: { name: true } },
        },
      }),
      this.prisma.eventActivity.count({ where: { eventId } }),
    ]);
    return { items, total };
  }
}
