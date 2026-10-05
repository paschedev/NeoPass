import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventPermission } from '@prisma/client';
import { EVENT_PERMISSIONS, permissionDeniedMessage } from './co-organizers';
import { EventAccessRepository } from './repositories/event-access.repository';

export type EventAccess = {
  role: 'OWNER' | 'CO_ORGANIZER';
  // The owner can do everything.
  permissions: EventPermission[];
  // Most free tickets they can have sent; null = no limit.
  freeTicketLimit: number | null;
  // The co-organizer's staff row; null for the owner.
  coOrganizerId: string | null;
};

export const canDo = (access: EventAccess, permission: EventPermission) =>
  access.permissions.includes(permission);

export function assertPermission(
  access: EventAccess,
  permission: EventPermission,
) {
  if (!canDo(access, permission)) {
    throw new ForbiddenException(permissionDeniedMessage(permission));
  }
}

// Who can do what on an event: its owner, or a co-organizer who accepted the
// invitation. To anyone else the event does not exist.
@Injectable()
export class EventAccessService {
  constructor(private readonly eventAccessRepository: EventAccessRepository) {}

  async getAccess(eventId: string, userId: string): Promise<EventAccess> {
    const found = await this.eventAccessRepository.findEventAccess(
      eventId,
      userId,
    );
    if (found?.organizerId === userId) {
      return {
        role: 'OWNER',
        permissions: EVENT_PERMISSIONS,
        freeTicketLimit: null,
        coOrganizerId: null,
      };
    }
    if (found?.coOrganizer) {
      const { id, permissions, freeTicketLimit } = found.coOrganizer;
      return {
        role: 'CO_ORGANIZER',
        permissions,
        freeTicketLimit,
        coOrganizerId: id,
      };
    }
    throw new NotFoundException('Evento no encontrado');
  }

  async assertCan(
    eventId: string,
    userId: string,
    permission: EventPermission,
  ) {
    const access = await this.getAccess(eventId, userId);
    assertPermission(access, permission);
    return access;
  }

  // Only the owner: co-organizers, managing, money and history included.
  async assertOwner(eventId: string, userId: string) {
    const access = await this.getAccess(eventId, userId);
    if (access.role !== 'OWNER') {
      throw new ForbiddenException(
        'Solo quien organiza el evento puede hacer esto',
      );
    }
    return access;
  }
}
