import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { organizerDisplayName } from '../common/organizer-name';
import { getEventPhase } from '../events/event-phase';
import { MailService } from '../mail/mail.service';
import { ticketCode } from '../mail/tickets-pdf';
import { NotificationsService } from '../notifications/notifications.service';
import { eventForMail } from '../tickets/event-for-mail';
import { AdminRepository } from './repositories/admin.repository';

const EVENTS_PAGE_SIZE = 20;
const TICKETS_PAGE_SIZE = 20;
const ZERO = new Prisma.Decimal(0);

type AdminTicketRow = Awaited<
  ReturnType<AdminRepository['findTickets']>
>['items'][number];

// A ticket as support reads it: who has it, who bought it if that was someone
// else, and where it came from (a purchase or a free ticket).
function toAdminTicket({
  userId,
  user,
  ticketType: { batch, event, name },
  order,
  freeTicketGrant: grant,
  ...ticket
}: AdminTicketRow) {
  return {
    ...ticket,
    code: ticketCode(ticket.id),
    event,
    ticketType: { name, batchName: batch?.name ?? null },
    owner:
      user ??
      (grant && { name: grant.recipientName, email: grant.recipientEmail }),
    buyer: order && order.userId !== userId ? order.user : null,
    origin: order
      ? {
          type: 'PURCHASE' as const,
          purchasedAt: order.createdAt,
          total: order.totalAmount.toNumber(),
          promoterName: order.promoter?.user.name ?? null,
        }
      : grant && {
          type: 'FREE' as const,
          sentBy: grant.issuedBy.name,
          validUntil: grant.validUntil,
        },
  };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly adminRepository: AdminRepository,
    private readonly notificationsService: NotificationsService,
    private readonly mailService: MailService,
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
          marketplaceFee: (
            money.get(event.id)?.marketplaceFee ?? ZERO
          ).toNumber(),
        },
      })),
      total,
      page,
      limit: EVENTS_PAGE_SIZE,
    };
  }

  async listTickets(q: string | undefined, page: number) {
    const { items, total } = await this.adminRepository.findTickets({
      search: q?.trim() || undefined,
      skip: (page - 1) * TICKETS_PAGE_SIZE,
      take: TICKETS_PAGE_SIZE,
    });
    return {
      items: items.map(toAdminTicket),
      total,
      page,
      limit: TICKETS_PAGE_SIZE,
    };
  }

  // The same ticket, QR included, to whoever has it: the account that owns a
  // bought one, or the email a free one was sent to (it has no account and
  // can't be transferred). Never anyone else: that would be giving it away.
  async resendTicket(ticketId: string, adminId: string) {
    const ticket = await this.adminRepository.findTicketForResend(ticketId);
    if (!ticket) throw new NotFoundException('Entrada no encontrada');
    if (ticket.status !== 'VALID') {
      throw new ConflictException('Solo se reenvían las entradas válidas.');
    }
    const { event } = ticket.ticketType;
    if (getEventPhase(event, new Date()) === 'CLOSED') {
      throw new ConflictException(
        'El evento terminó, se canceló o se dio de baja: la entrada ya no sirve.',
      );
    }

    const tickets = [
      {
        id: ticket.id,
        qrCode: ticket.qrCode,
        ticketTypeName: ticket.ticketType.name,
        ...eventForMail(event),
      },
    ];
    const grant = ticket.freeTicketGrant;
    let sentTo: string;
    if (grant) {
      await this.mailService.queueFreeTicketsEmail(
        {
          to: grant.recipientEmail,
          name: grant.recipientName,
          organizerName: organizerDisplayName(event.organizer),
          eventId: event.id,
          validUntil: grant.validUntil?.toISOString() ?? null,
          tickets,
        },
        `admin-resend-${ticket.id}-${Date.now()}`,
      );
      sentTo = grant.recipientEmail;
    } else if (ticket.user) {
      await this.mailService.queueTicketsEmail({
        to: ticket.user.email,
        name: ticket.user.name,
        tickets,
      });
      sentTo = ticket.user.email;
    } else {
      throw new ConflictException('La entrada no tiene a quién mandarla.');
    }
    this.logger.log(`Admin ${adminId} resent ticket ${ticket.id}`);
    return { sentTo };
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
