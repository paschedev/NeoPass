import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventPermission } from '@prisma/client';
import { EVENT_PERMISSIONS, permissionDeniedMessage } from './co-organizers';
import { coOrganizerSendsFreeTickets } from './promoter-free-tickets';
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

export type FreeTicketsAccess = {
  // The owner sees and handles every grant; the rest, only their own.
  role: 'OWNER' | 'CO_ORGANIZER' | 'PROMOTER';
  // The staff row whose sent tickets count for the limit; null = no limit.
  quota: { staffId: string; limit: number } | null;
};

type FoundAccess = Awaited<
  ReturnType<EventAccessRepository['findEventAccess']>
>;

// Who sends free tickets: the owner, a co-organizer allowed to (their rule
// wins when they also promote the event) or a promoter the owner allowed,
// always with a limit. Null if the user can't.
function freeTicketsAccessOf(
  found: FoundAccess,
  userId: string,
): FreeTicketsAccess | null {
  if (!found) return null;
  if (found.organizerId === userId) return { role: 'OWNER', quota: null };
  const { coOrganizer, promoter } = found;
  if (coOrganizer && coOrganizerSendsFreeTickets(coOrganizer)) {
    return {
      role: 'CO_ORGANIZER',
      quota:
        coOrganizer.freeTicketLimit === null
          ? null
          : { staffId: coOrganizer.id, limit: coOrganizer.freeTicketLimit },
    };
  }
  if (
    promoter?.permissions.includes('SEND_FREE_TICKETS') &&
    promoter.freeTicketLimit !== null
  ) {
    return {
      role: 'PROMOTER',
      quota: { staffId: promoter.id, limit: promoter.freeTicketLimit },
    };
  }
  return null;
}

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

  // How the user sends free tickets on the event, or null if they can't.
  async getFreeTicketsAccess(eventId: string, userId: string) {
    return freeTicketsAccessOf(
      await this.eventAccessRepository.findEventAccess(eventId, userId),
      userId,
    );
  }

  async assertCanSendFreeTickets(
    eventId: string,
    userId: string,
  ): Promise<FreeTicketsAccess> {
    const found = await this.eventAccessRepository.findEventAccess(
      eventId,
      userId,
    );
    const access = freeTicketsAccessOf(found, userId);
    if (access) return access;
    if (found?.coOrganizer || found?.promoter) {
      throw new ForbiddenException(
        permissionDeniedMessage('SEND_FREE_TICKETS'),
      );
    }
    throw new NotFoundException('Evento no encontrado');
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
