import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getEventPhase } from '../events/event-phase';
import { MailService } from '../mail/mail.service';
import { SendFreeTicketsDto } from './dto/send-free-tickets.dto';
import { eventForMail } from './event-for-mail';
import {
  FREE_TICKETS_RESEND_COOLDOWN_MS,
  MAX_FREE_TICKET_GRANTS_PER_HOUR,
  toGrantResponse,
  validUntilError,
} from './free-tickets';
import { FreeTicketsRepository } from './repositories/free-tickets.repository';

const HOUR_MS = 60 * 60 * 1000;

type OrganizerEvent = NonNullable<
  Awaited<ReturnType<FreeTicketsRepository['findOrganizerEvent']>>
>;

@Injectable()
export class FreeTicketsService {
  constructor(
    private readonly freeTicketsRepository: FreeTicketsRepository,
    private readonly mailService: MailService,
  ) {}

  async send(eventId: string, organizerId: string, dto: SendFreeTicketsDto) {
    const event = await this.findEvent(eventId, organizerId);
    if (event.status === 'DRAFT') {
      throw new ConflictException('Publicá el evento antes de mandar QR free');
    }
    const now = new Date();
    if (getEventPhase(event, now) === 'CLOSED') {
      throw new ConflictException(
        'No se pueden mandar QR free de un evento terminado o cancelado',
      );
    }

    const ticketType = await this.freeTicketsRepository.findEventTicketType(
      eventId,
      dto.ticketTypeId,
    );
    if (!ticketType) {
      throw new NotFoundException('Tipo de entrada no encontrado');
    }

    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    const deadlineError = validUntil && validUntilError(validUntil, event, now);
    if (deadlineError) throw new BadRequestException(deadlineError);

    const sentLastHour =
      await this.freeTicketsRepository.countGrantsIssuedSince(
        organizerId,
        new Date(now.getTime() - HOUR_MS),
      );
    if (sentLastHour >= MAX_FREE_TICKET_GRANTS_PER_HOUR) {
      throw new HttpException(
        `Llegaste al límite de ${MAX_FREE_TICKET_GRANTS_PER_HOUR} envíos por hora. Probá de nuevo más tarde.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const grant = await this.freeTicketsRepository.createGrant({
      eventId,
      ticketTypeId: ticketType.id,
      issuedById: organizerId,
      recipientEmail: dto.email,
      recipientName: dto.name ?? null,
      validUntil,
      quantity: dto.quantity,
    });
    await this.queueMail(event, grant, `free-tickets-${grant.id}`);
    return toGrantResponse(grant);
  }

  async list(eventId: string, organizerId: string) {
    await this.findEvent(eventId, organizerId);
    const grants = await this.freeTicketsRepository.findGrants(eventId);
    return grants.map(toGrantResponse);
  }

  // The tickets not used yet stop working; the used ones stay as they are.
  async cancel(eventId: string, grantId: string, organizerId: string) {
    await this.findGrant(eventId, grantId, organizerId);
    const cancelled = await this.freeTicketsRepository.cancelGrant(
      grantId,
      new Date(),
    );
    if (!cancelled) {
      throw new ConflictException('Este envío ya estaba anulado');
    }
    return toGrantResponse(await this.findGrant(eventId, grantId, organizerId));
  }

  // Sends again the tickets that can still be used, to the same email.
  async resend(eventId: string, grantId: string, organizerId: string) {
    const { event, grant } = await this.findGrantWithEvent(
      eventId,
      grantId,
      organizerId,
    );
    if (grant.cancelledAt) {
      throw new ConflictException('Este envío está anulado');
    }
    const usable =
      await this.freeTicketsRepository.findUsableGrantTickets(grantId);
    if (usable.length === 0) {
      throw new ConflictException(
        'Todas las entradas de este envío ya se usaron',
      );
    }

    const now = new Date();
    const resent = await this.freeTicketsRepository.markResent(
      grantId,
      now,
      new Date(now.getTime() - FREE_TICKETS_RESEND_COOLDOWN_MS),
    );
    if (!resent) {
      throw new HttpException(
        'Este envío se mandó hace menos de 10 minutos. Probá de nuevo en un rato.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.queueMail(
      event,
      grant,
      `free-tickets-${grantId}-${now.getTime()}`,
    );
    return toGrantResponse({ ...grant, lastSentAt: now });
  }

  private async findEvent(eventId: string, organizerId: string) {
    const event = await this.freeTicketsRepository.findOrganizerEvent(
      eventId,
      organizerId,
    );
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  private async findGrantWithEvent(
    eventId: string,
    grantId: string,
    organizerId: string,
  ) {
    const event = await this.findEvent(eventId, organizerId);
    const grant = await this.freeTicketsRepository.findGrant(eventId, grantId);
    if (!grant) throw new NotFoundException('Envío no encontrado');
    return { event, grant };
  }

  private async findGrant(
    eventId: string,
    grantId: string,
    organizerId: string,
  ) {
    return (await this.findGrantWithEvent(eventId, grantId, organizerId)).grant;
  }

  // After the grant is saved, never inside its transaction.
  private async queueMail(
    event: OrganizerEvent,
    grant: {
      id: string;
      recipientEmail: string;
      recipientName: string | null;
      validUntil: Date | null;
    },
    jobId: string,
  ) {
    const tickets = await this.freeTicketsRepository.findUsableGrantTickets(
      grant.id,
    );
    await this.mailService.queueFreeTicketsEmail(
      {
        to: grant.recipientEmail,
        name: grant.recipientName,
        organizerName: event.organizer.name,
        eventId: event.id,
        validUntil: grant.validUntil?.toISOString() ?? null,
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          qrCode: ticket.qrCode,
          ticketTypeName: ticket.ticketType.name,
          ...eventForMail(event),
        })),
      },
      jobId,
    );
  }
}
