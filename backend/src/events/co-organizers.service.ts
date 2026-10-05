import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StaffStatus } from '@prisma/client';
import {
  coOrganizerTerms,
  describePermissions,
  permissionsError,
} from './co-organizers';
import { UpdateCoOrganizerDto } from './dto/update-co-organizer.dto';
import { EventAccessService } from './event-access.service';
import { CoOrganizersRepository } from './repositories/co-organizers.repository';

const ACTIVITY_PAGE_SIZE = 50;

// Accepted first, then the ones still to answer, then the rejected ones.
const STATUS_ORDER: Record<StaffStatus, number> = {
  ACCEPTED: 0,
  PENDING: 1,
  REJECTED: 2,
};

type CoOrganizerRow = Awaited<
  ReturnType<CoOrganizersRepository['findCoOrganizers']>
>[number];

const toCoOrganizer = ({ user, ...staff }: CoOrganizerRow) => ({
  ...staff,
  name: user.name,
  email: user.email,
});

// The owner's side of co-organizers: who they are, what they can do, and the
// history of what was done on the event.
@Injectable()
export class CoOrganizersService {
  constructor(
    private readonly eventAccess: EventAccessService,
    private readonly coOrganizersRepository: CoOrganizersRepository,
  ) {}

  async list(eventId: string, userId: string) {
    await this.eventAccess.assertOwner(eventId, userId);
    const rows = await this.coOrganizersRepository.findCoOrganizers(eventId);
    return rows
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          a.user.name.localeCompare(b.user.name, 'es'),
      )
      .map(toCoOrganizer);
  }

  // Applies right away, also to an invitation not answered yet.
  async update(
    eventId: string,
    staffId: string,
    userId: string,
    { permissions, freeTicketLimit }: UpdateCoOrganizerDto,
  ) {
    await this.eventAccess.assertOwner(eventId, userId);
    const error = permissionsError(permissions);
    if (error) throw new BadRequestException(error);
    const current = await this.findCoOrganizer(eventId, staffId);

    const terms = coOrganizerTerms(permissions, freeTicketLimit);
    const updated = await this.coOrganizersRepository.updateCoOrganizer(
      staffId,
      terms,
      {
        eventId,
        actorId: userId,
        type: 'CO_ORGANIZER_UPDATED',
        summary: `Cambió los permisos de ${current.user.name}. Ahora puede ${describePermissions(terms.permissions, terms.freeTicketLimit)}.`,
      },
    );
    if (!updated) throw new NotFoundException('Co-organizador no encontrado');
    return toCoOrganizer(updated);
  }

  // What they already did stays (free tickets sent, payments recorded).
  async remove(eventId: string, staffId: string, userId: string) {
    await this.eventAccess.assertOwner(eventId, userId);
    const current = await this.findCoOrganizer(eventId, staffId);
    const removed = await this.coOrganizersRepository.removeCoOrganizer(
      staffId,
      {
        eventId,
        actorId: userId,
        type: 'CO_ORGANIZER_REMOVED',
        summary: `Quitó a ${current.user.name} de los co-organizadores.`,
      },
    );
    if (!removed) throw new NotFoundException('Co-organizador no encontrado');
  }

  async activity(eventId: string, userId: string, page: number) {
    await this.eventAccess.assertOwner(eventId, userId);
    const { items, total } = await this.coOrganizersRepository.findActivityPage(
      eventId,
      (page - 1) * ACTIVITY_PAGE_SIZE,
      ACTIVITY_PAGE_SIZE,
    );
    return { items, total, page, limit: ACTIVITY_PAGE_SIZE };
  }

  private async findCoOrganizer(eventId: string, staffId: string) {
    const current = await this.coOrganizersRepository.findCoOrganizer(
      eventId,
      staffId,
    );
    if (!current) throw new NotFoundException('Co-organizador no encontrado');
    return current;
  }
}
