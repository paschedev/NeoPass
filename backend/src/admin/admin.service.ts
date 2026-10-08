import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getEventPhase } from '../events/event-phase';
import { AdminRepository } from './repositories/admin.repository';

const EVENTS_PAGE_SIZE = 20;

@Injectable()
export class AdminService {
  constructor(private readonly adminRepository: AdminRepository) {}

  async listEvents(q: string | undefined, page: number) {
    const { items, total } = await this.adminRepository.findEvents({
      search: q?.trim() || undefined,
      skip: (page - 1) * EVENTS_PAGE_SIZE,
      take: EVENTS_PAGE_SIZE,
    });
    return { items, total, page, limit: EVENTS_PAGE_SIZE };
  }

  // Applies from the next purchase on: a started order keeps the fee it was
  // priced with, and that is what Mercado Pago charges.
  async updateServiceFee(eventId: string, percentage: number) {
    const event = await this.adminRepository.findEventPhase(eventId);
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (getEventPhase(event, new Date()) === 'CLOSED') {
      throw new ConflictException(
        'El evento ya no vende entradas: su cargo no se puede cambiar.',
      );
    }
    return this.adminRepository.updateServiceFee(eventId, percentage);
  }
}
