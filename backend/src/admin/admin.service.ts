import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { getEventPhase } from '../events/event-phase';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminRepository } from './repositories/admin.repository';

const EVENTS_PAGE_SIZE = 20;
const ZERO = new Prisma.Decimal(0);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listEvents(q: string | undefined, page: number) {
    const { items, total } = await this.adminRepository.findEvents({
      search: q?.trim() || undefined,
      skip: (page - 1) * EVENTS_PAGE_SIZE,
      take: EVENTS_PAGE_SIZE,
    });
    const { tickets, money } = await this.adminRepository.sumSalesByEvent(
      items.map((item) => item.id),
    );
    return {
      items: items.map(({ deletedById, organizerId, ...event }) => ({
        ...event,
        // Whoever isn't its organizer deleted it on behalf of NeoPass.
        deletedByNeoPass: event.deletedAt ? deletedById !== organizerId : null,
        sales: {
          sold: tickets.get(event.id)?.sold ?? 0,
          capacity: tickets.get(event.id)?.capacity ?? 0,
          revenue: (money.get(event.id)?.revenue ?? ZERO).toNumber(),
          serviceFee: (money.get(event.id)?.serviceFee ?? ZERO).toNumber(),
        },
      })),
      total,
      page,
      limit: EVENTS_PAGE_SIZE,
    };
  }

  // Applies from the next purchase on: a started order keeps the fee it was
  // priced with, and that is what Mercado Pago charges.
  async updateServiceFee(eventId: string, percentage: number, adminId: string) {
    const event = await this.adminRepository.findEventPhase(eventId);
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (getEventPhase(event, new Date()) === 'CLOSED') {
      throw new ConflictException(
        'El evento ya no vende entradas: su cargo no se puede cambiar.',
      );
    }
    const updated = await this.adminRepository.updateServiceFee(
      eventId,
      percentage,
    );
    this.logger.log(
      `Admin ${adminId} set the service fee of event ${eventId} to ${percentage}%`,
    );
    return updated;
  }

  // The event comes back as it was before its deletion: if it hasn't ended
  // it sells again, and its valid tickets get in again. Their holders were
  // told their tickets no longer worked, so they hear about it, and so does
  // the organizer.
  async restoreEvent(eventId: string, adminId: string) {
    const event = await this.adminRepository.findEventForRestore(eventId);
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (!(await this.adminRepository.restoreEvent(eventId))) {
      throw new ConflictException('El evento no está eliminado.');
    }
    this.logger.log(`Admin ${adminId} restored event ${eventId}`);

    const ticketsWorkAgain =
      getEventPhase({ ...event, deletedAt: null }, new Date()) !== 'CLOSED';
    try {
      await this.notificationsService.notifyEventRestored(
        event,
        adminId,
        ticketsWorkAgain,
      );
    } catch (error) {
      this.logger.error(
        `Could not notify the restore of event ${eventId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return { id: eventId, deletedAt: null };
  }
}
