import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventAccessRepository } from './repositories/event-access.repository';

// Who can do what on an event: its owner, or a co-organizer who accepted the
// invitation. To anyone else the event does not exist.
@Injectable()
export class EventAccessService {
  constructor(private readonly eventAccessRepository: EventAccessRepository) {}

  // Only the owner: co-organizers, managing, money and history included.
  async assertOwner(eventId: string, userId: string) {
    const access = await this.eventAccessRepository.findEventAccess(
      eventId,
      userId,
    );
    if (access?.organizerId === userId) return access;
    if (access?.coOrganizer) {
      throw new ForbiddenException(
        'Solo quien organiza el evento puede hacer esto',
      );
    }
    throw new NotFoundException('Evento no encontrado');
  }
}
