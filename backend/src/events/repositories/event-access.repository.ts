import { Injectable } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Who owns the event and, if the user co-organizes or promotes it
  // (accepted), what they can do on it.
  async findEventAccess(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        staff: {
          where: {
            userId,
            status: 'ACCEPTED',
            role: { in: ['MANAGER', 'PROMOTER'] },
          },
          select: {
            id: true,
            role: true,
            permissions: true,
            freeTicketLimit: true,
          },
        },
      },
    });
    if (!event) return null;
    const { staff, ...rest } = event;
    // One row per role at most (@@unique on event, user and role).
    const roleRow = (role: StaffRole) => {
      const row = staff.find((member) => member.role === role);
      return row
        ? {
            id: row.id,
            permissions: row.permissions,
            freeTicketLimit: row.freeTicketLimit,
          }
        : null;
    };
    return {
      ...rest,
      coOrganizer: roleRow('MANAGER'),
      promoter: roleRow('PROMOTER'),
    };
  }
}
