import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EventAccessRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Who owns the event and, if the user co-organizes it (accepted), what they
  // can do on it.
  async findEventAccess(eventId: string, userId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        organizerId: true,
        staff: {
          where: { userId, role: 'MANAGER', status: 'ACCEPTED' },
          select: { id: true, permissions: true, freeTicketLimit: true },
          take: 1,
        },
      },
    });
    if (!event) return null;
    const { staff, ...rest } = event;
    return { ...rest, coOrganizer: staff[0] ?? null };
  }
}
