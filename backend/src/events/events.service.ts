import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  EventsRepository,
  InvitationAnswer,
} from './repositories/events.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { StaffRole, CommissionType, Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { buildRevenueChart } from './revenue-chart';
import { getBatchSaleStatus } from './batch-sale-status';
import { getEventPhase } from './event-phase';
import { PromoterClicksService } from './promoter-clicks.service';
import { hasUsableMercadoPagoToken } from '../payments/mercadopago-token';
import { planBatchChanges } from './batch-changes';
import { BatchSaleAction, planBatchSaleAction } from './batch-sale-action';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { BatchDto } from './dto/batch.dto';
import { EventLocationDto } from './dto/event-location.dto';

// Role names as the organizer reads them (errors and notices in their panel).
const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  PROMOTER: 'promotor',
  SCANNER: 'scanner',
  MANAGER: 'encargado',
};

// The invitee reads it first: "RPP" is what their panel is called.
const INVITED_ROLE_LABEL: Record<StaffRole, string> = {
  ...STAFF_ROLE_LABEL,
  PROMOTER: 'promotor (RPP)',
};

function assertEndAfterStart(startDate: Date, endDate: Date) {
  if (endDate <= startDate) {
    throw new BadRequestException(
      'La fecha de fin tiene que ser posterior a la de inicio',
    );
  }
}

type EventForEdit = {
  status: string;
  startDate: Date;
  endDate: Date;
  venueName: string | null;
  venueAddress: string | null;
  venueCity: string | null;
  latitude: number | null;
  longitude: number | null;
};

// The map location is both coordinates or none: a single one, or one cleared
// without the other, would leave the event pointing nowhere.
function assertCompleteLocation({ latitude, longitude }: EventLocationDto) {
  const sent = [latitude, longitude].filter((value) => value !== undefined);
  const complete =
    sent.length === 0 ||
    (sent.length === 2 && (latitude === null) === (longitude === null));
  if (!complete) {
    throw new BadRequestException(
      'La ubicación en el mapa necesita latitud y longitud',
    );
  }
}

// Finished and cancelled events are read only; an event whose end already
// passed counts as finished even before the cron marks it.
function assertEditable(event: EventForEdit, now: Date) {
  const phase = getEventPhase(event, now);
  if (phase === 'CLOSED') {
    throw new ConflictException(
      event.status === 'CANCELLED'
        ? 'Un evento cancelado no se puede editar'
        : 'Un evento finalizado no se puede editar',
    );
  }
  return phase;
}

const VENUE_FIELDS = [
  'venueName',
  'venueAddress',
  'venueCity',
  'latitude',
  'longitude',
] as const;

const BATCHES_LOCKED_MESSAGE =
  'El evento ya empezó: las tandas no se pueden cambiar (la venta sigue)';

const ALREADY_APPLIED_MESSAGE: Record<BatchSaleAction, string> = {
  END: 'La venta de esta tanda ya está finalizada',
  REOPEN: 'La venta de esta tanda no está finalizada',
  HIDE: 'La tanda ya está oculta',
  SHOW: 'La tanda ya está visible',
};

// Once the event starts, buyers already hold tickets for its start and venue:
// only texts and the image change, the end can only move later and the
// batches stay as they are while they keep selling. Unchanged values are fine.
function assertInProgressChanges(event: EventForEdit, changes: UpdateEventDto) {
  const changesStart =
    changes.startDate !== undefined &&
    new Date(changes.startDate).getTime() !== event.startDate.getTime();
  const changesVenue = VENUE_FIELDS.some(
    (field) => changes[field] !== undefined && changes[field] !== event[field],
  );
  if (changesStart || changesVenue) {
    throw new ConflictException(
      'El evento ya empezó: el inicio y el lugar no se pueden cambiar',
    );
  }
  if (changes.batches) throw new ConflictException(BATCHES_LOCKED_MESSAGE);
  if (changes.endDate && new Date(changes.endDate) < event.endDate) {
    throw new BadRequestException(
      'El evento ya empezó: el fin solo se puede extender',
    );
  }
}

type ExistingBatch = { id: string; ticketTypes: { id: string }[] };
type ExistingBatchWithSales = {
  ticketTypes: { id: string; name: string; sold: number; reserved: number }[];
};

type BatchWindow = {
  id?: string;
  name: string;
  publishAt?: string | Date | null;
  closeAt?: string | Date | null;
};

// A batch sells from publishAt to closeAt, or to the end of the event. A closeAt
// in the past is allowed: that is how an organizer ends a sale right now. A new
// publishAt can't be in the past, but a stored one is kept while it sells.
function assertBatchWindows(
  batches: BatchWindow[],
  stored: { id: string; publishAt: Date | null }[],
  eventEndDate: Date,
  now: Date,
) {
  const storedStart = new Map(
    stored.map((batch) => [batch.id, batch.publishAt?.getTime() ?? null]),
  );
  for (const batch of batches) {
    const publishAt = batch.publishAt ? new Date(batch.publishAt) : null;
    const closeAt = batch.closeAt ? new Date(batch.closeAt) : null;
    if (closeAt && closeAt > eventEndDate) {
      throw new BadRequestException(
        `La venta de "${batch.name}" no puede terminar después del evento`,
      );
    }
    if (publishAt && publishAt >= (closeAt ?? eventEndDate)) {
      throw new BadRequestException(
        closeAt
          ? `En "${batch.name}", el inicio de venta tiene que ser anterior al fin de venta`
          : `La venta de "${batch.name}" tiene que empezar antes de que termine el evento`,
      );
    }
    const keepsStoredStart =
      batch.id !== undefined &&
      storedStart.get(batch.id) === (publishAt?.getTime() ?? null);
    if (publishAt && publishAt < now && !keepsStoredStart) {
      throw new BadRequestException(
        `El inicio de venta de "${batch.name}" ya pasó`,
      );
    }
  }
}

// Batch and ticket type IDs come from the client: each one has to belong to the
// event being edited (and each ticket type to its batch) before anything is written.
function assertOwnBatchIds(
  existing: ExistingBatch[],
  incoming: BatchDto[] = [],
) {
  const typeIdsByBatch = new Map(
    existing.map((batch) => [
      batch.id,
      new Set(batch.ticketTypes.map((ticketType) => ticketType.id)),
    ]),
  );
  for (const batch of incoming) {
    const ownTypeIds = batch.id
      ? typeIdsByBatch.get(batch.id)
      : new Set<string>();
    const hasForeignType = batch.ticketTypes.some(
      (ticketType) => ticketType.id && !ownTypeIds?.has(ticketType.id),
    );
    if (!ownTypeIds || hasForeignType) {
      throw new ForbiddenException(
        'No tenés permiso sobre esa tanda o entrada',
      );
    }
  }
}

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationsService: NotificationsService,
    private readonly promoterClicks: PromoterClicksService,
  ) {}

  async findPublicPage(page: number, limit: number) {
    const { items, total } = await this.eventsRepository.findPublicPage(
      new Date(),
      (page - 1) * limit,
      limit,
    );
    return { items, total, page, limit };
  }

  async findOne(id: string, rppId?: string, visitorIp?: string) {
    // Drafts, cancelled and finished events are not public; organizers use
    // GET /events/organizer/:id instead.
    const event = await this.eventsRepository.findPublicById(id, new Date());
    if (!event) throw new NotFoundException('Evento no encontrado');

    if (rppId && visitorIp) {
      await this.promoterClicks.register(event.id, rppId, visitorIp);
    }

    // Buyers see upcoming, on sale and sold out batches, and how many tickets
    // are left instead of the raw stock counters.
    const now = new Date();
    const ticketBatches = event.ticketBatches
      .map(({ isVisible, ticketTypes, ...batch }) => ({
        ...batch,
        saleStatus: getBatchSaleStatus(
          { ...batch, isVisible, ticketTypes },
          event.endDate,
          now,
        ),
        ticketTypes: ticketTypes.map(
          ({ stock, sold, reserved, ...ticketType }) => ({
            ...ticketType,
            available: Math.max(0, stock - sold - reserved),
          }),
        ),
      }))
      .filter(
        ({ saleStatus }) => saleStatus !== 'HIDDEN' && saleStatus !== 'ENDED',
      );
    return { ...event, ticketBatches };
  }

  async create(userId: string, data: CreateEventDto) {
    const { batches, ...eventData } = data;
    const user = await this.userRepository.findById(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!hasUsableMercadoPagoToken(user, new Date())) {
      throw new BadRequestException(
        'Vinculá Mercado Pago antes de crear un evento',
      );
    }
    assertOwnBatchIds([], batches);
    assertCompleteLocation(data);
    const startDate = new Date(data.startDate);
    if (startDate <= new Date()) {
      throw new BadRequestException('La fecha de inicio tiene que ser futura');
    }
    const endDate = new Date(data.endDate);
    assertEndAfterStart(startDate, endDate);
    assertBatchWindows(batches, [], endDate, new Date());

    return this.eventsRepository.createWithBatches(
      { ...eventData, organizerId: userId },
      planBatchChanges([], batches),
    );
  }

  // For the organizer's own screens (edit, preview) and every change to the
  // event: any status, owner only.
  async findOneForOrganizer(id: string, organizerId: string) {
    const event = await this.eventsRepository.findOne(id);
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('No tenés permiso sobre este evento');
    }
    return event;
  }

  async update(id: string, organizerId: string, changes: UpdateEventDto) {
    const { batches, ...eventData } = changes;
    const event = await this.findOneForOrganizer(id, organizerId);
    const now = new Date();
    const phase = assertEditable(event, now);
    assertCompleteLocation(changes);
    const startDate = changes.startDate
      ? new Date(changes.startDate)
      : event.startDate;
    if (phase === 'IN_PROGRESS') {
      assertInProgressChanges(event, changes);
    } else if (
      startDate.getTime() !== event.startDate.getTime() &&
      startDate <= now
    ) {
      throw new BadRequestException('La fecha de inicio tiene que ser futura');
    }
    const endDate = changes.endDate ? new Date(changes.endDate) : event.endDate;
    assertEndAfterStart(startDate, endDate);

    const backToDraft = changes.status === 'DRAFT' && event.status !== 'DRAFT';
    const hasTicketsTaken = event.ticketTypes.some(
      (ticketType) => ticketType.sold + ticketType.reserved > 0,
    );
    if (backToDraft && hasTicketsTaken) {
      throw new ConflictException(
        'Un evento con entradas vendidas o reservadas no puede volver a borrador',
      );
    }
    assertOwnBatchIds(event.ticketBatches, batches);
    // Without batches in the body, the stored ones still have to fit the event.
    assertBatchWindows(
      batches ?? event.ticketBatches,
      event.ticketBatches,
      endDate,
      now,
    );
    if (!batches) return this.eventsRepository.update(id, eventData);

    await this.assertBatchChangesAllowed(event.ticketBatches, batches);
    return this.eventsRepository.updateWithBatches(
      id,
      eventData,
      planBatchChanges(event.ticketBatches, batches),
    );
  }

  async findByOrganizer(userId: string) {
    return this.eventsRepository.findByOrganizer(userId);
  }

  async updateBatches(
    eventId: string,
    organizerId: string,
    batchesData: BatchDto[],
  ) {
    const eventContext = await this.findOneForOrganizer(eventId, organizerId);
    const now = new Date();
    if (assertEditable(eventContext, now) === 'IN_PROGRESS') {
      throw new ConflictException(BATCHES_LOCKED_MESSAGE);
    }
    assertOwnBatchIds(eventContext.ticketBatches, batchesData);
    assertBatchWindows(
      batchesData,
      eventContext.ticketBatches,
      eventContext.endDate,
      now,
    );
    await this.assertBatchChangesAllowed(
      eventContext.ticketBatches,
      batchesData,
    );

    return this.eventsRepository.updateBatchesTransaction(
      eventId,
      planBatchChanges(eventContext.ticketBatches, batchesData),
    );
  }

  // Ends or reopens the sale of one batch, or hides or shows it, right away.
  // Unlike the rest of the batch, this also works while the event is running.
  async changeBatchSale(
    eventId: string,
    organizerId: string,
    batchId: string,
    action: BatchSaleAction,
  ) {
    const event = await this.findOneForOrganizer(eventId, organizerId);
    const now = new Date();
    assertEditable(event, now);
    const batch = event.ticketBatches.find(({ id }) => id === batchId);
    if (!batch) throw new NotFoundException('Tanda no encontrada');

    const change = planBatchSaleAction(batch, action, now);
    if (!change) throw new ConflictException(ALREADY_APPLIED_MESSAGE[action]);
    return this.eventsRepository.updateBatchSale(eventId, batchId, change);
  }

  // Sold and reserved tickets keep their place in the stock, and a ticket type
  // with orders or tickets can't be deleted: they still point to it.
  private async assertBatchChangesAllowed(
    existing: ExistingBatchWithSales[],
    incoming: BatchDto[],
  ) {
    const incomingStock = new Map<string, number>();
    for (const batch of incoming) {
      for (const ticketType of batch.ticketTypes) {
        if (ticketType.id) incomingStock.set(ticketType.id, ticketType.stock);
      }
    }
    const existingTypes = existing.flatMap((batch) => batch.ticketTypes);

    for (const ticketType of existingTypes) {
      const taken = ticketType.sold + ticketType.reserved;
      const stock = incomingStock.get(ticketType.id);
      if (stock !== undefined && stock < taken) {
        throw new ConflictException(
          `El stock de "${ticketType.name}" no puede ser menor a sus ${taken} entradas vendidas o reservadas`,
        );
      }
    }

    const removedIds = existingTypes
      .filter((ticketType) => !incomingStock.has(ticketType.id))
      .map((ticketType) => ticketType.id);
    if (removedIds.length === 0) return;

    const inUse = await this.eventsRepository.findTicketTypesInUse(removedIds);
    if (inUse.length > 0) {
      const names = inUse.map((ticketType) => `"${ticketType.name}"`);
      throw new ConflictException(
        `No se pueden borrar entradas que ya tienen órdenes (${names.join(', ')}). Podés ocultar o finalizar su tanda.`,
      );
    }
  }

  async getOrganizerStats(userId: string) {
    const events =
      await this.eventsRepository.getOrganizerEventsWithTickets(userId);

    const eventIds = events.map((e) => e.id);

    // Fetch PAID orders containing items from these events
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const paidOrders = await this.eventsRepository.getPaidOrdersForEvents(
      eventIds,
      thirtyDaysAgo,
    );
    const totalRevenue =
      await this.eventsRepository.sumPaidTicketAmountForOrganizer(userId);

    // Tickets sold for ALL time, from ticketTypes.sold
    const totalSold = events
      .flatMap((event) => event.ticketTypes)
      .reduce((sum, ticketType) => sum + ticketType.sold, 0);

    const chartData = buildRevenueChart(paidOrders, eventIds, new Date());

    // Las últimas 50 ventas para el widget de "Últimas Ventas" y el Historial
    const recentTransactions = paidOrders.slice(0, 50).map((order) => ({
      id: order.id,
      name: order.user?.name || 'Usuario',
      event: order.orderItems[0]?.ticketType?.event?.title || 'Evento',
      amount: Number(order.ticketAmount),
      time: order.createdAt,
      status: order.status,
    }));

    return {
      totalEvents: events.length,
      totalTicketsSold: totalSold,
      totalRevenue: totalRevenue.toNumber(),
      activeEvents: events.filter((e) => e.status === 'PUBLISHED').length,
      chartData, // Returns last 30 days of real revenue
      recentTransactions,
    };
  }

  async getOrganizerStaff(organizerId: string) {
    return this.eventsRepository.getOrganizerStaff(organizerId);
  }

  async addStaff(
    eventId: string,
    organizerId: string,
    inviteeId: string,
    role: StaffRole,
    commissionType?: CommissionType,
    commissionValue?: number,
  ) {
    const event = await this.findOneForOrganizer(eventId, organizerId);

    // Only promoters earn a commission: for the other roles it is ignored.
    const commissionTerms =
      role === 'PROMOTER' ? { commissionType, commissionValue } : {};
    if (
      role === 'PROMOTER' &&
      commissionType === 'PERCENTAGE' &&
      (commissionValue ?? 0) > 100
    ) {
      throw new BadRequestException(
        'El porcentaje de comisión tiene que estar entre 0 y 100',
      );
    }

    const user = await this.userRepository.findById(inviteeId);
    if (!user) {
      throw new NotFoundException(
        'Usuario no registrado. Pedile que se registre en NeoPass primero.',
      );
    }

    // One invitation per role: someone who rejected it can be invited again.
    const existing = await this.eventsRepository.findEventStaff(
      eventId,
      user.id,
      role,
    );
    if (existing?.status === 'PENDING') {
      throw new ConflictException(
        `El usuario ya tiene una invitación pendiente como ${STAFF_ROLE_LABEL[role]} en este evento.`,
      );
    }
    if (existing?.status === 'ACCEPTED') {
      throw new ConflictException(
        `El usuario ya es ${STAFF_ROLE_LABEL[role]} de este evento.`,
      );
    }

    const staff = existing
      ? await this.eventsRepository.updateEventStaff(existing.id, {
          status: 'PENDING',
          ...commissionTerms,
        })
      : await this.eventsRepository.createEventStaff({
          event: { connect: { id: eventId } },
          user: { connect: { id: user.id } },
          role,
          ...commissionTerms,
        });

    let commission = '';
    if (role === 'PROMOTER' && commissionType && commissionValue) {
      commission =
        commissionType === 'PERCENTAGE'
          ? `, con ${commissionValue}% de comisión por entrada`
          : `, con $${commissionValue} de comisión por entrada`;
    }

    await this.notificationsService.create({
      userId: user.id,
      type: 'STAFF_INVITE',
      title: 'Nueva invitación',
      message: `Te invitaron${existing ? ' de nuevo' : ''} como ${INVITED_ROLE_LABEL[role]} al evento "${event.title}"${commission}.`,
      eventId: event.id,
      metadata: {
        eventStaffId: staff.id,
        role,
        ...commissionTerms,
        status: 'PENDING',
      },
    });

    return staff;
  }

  async getEventStaff(eventId: string, organizerId: string) {
    await this.findOneForOrganizer(eventId, organizerId);
    return this.eventsRepository.getEventStaffByEvent(eventId);
  }

  async getMyPromoterStats(userId: string) {
    const assignments = (
      await this.eventsRepository.findAcceptedPromoterAssignments(userId)
    ).map(({ orders, ...assignment }) => ({
      ...assignment,
      totalTicketsSold: orders
        .flatMap((order) => order.orderItems)
        .reduce((sum, item) => sum + item.quantity, 0),
    }));

    const totalEarned = Prisma.Decimal.sum(
      0,
      ...assignments.map((assignment) => assignment.totalEarned),
    );
    const totalPaid = Prisma.Decimal.sum(
      0,
      ...assignments.map((assignment) => assignment.totalPaid),
    );
    const totalTicketsSold = assignments.reduce(
      (acc, curr) => acc + curr.totalTicketsSold,
      0,
    );

    return {
      isPromoter: assignments.length > 0,
      totalEarned: totalEarned.toNumber(),
      totalPaid: totalPaid.toNumber(),
      totalTicketsSold,
      pendingBalance: totalEarned.minus(totalPaid).toNumber(),
      events: assignments,
    };
  }

  async getPromoterEventStats(userId: string, eventId: string) {
    const staff = await this.eventsRepository.getPromoterStatsForEvent(
      userId,
      eventId,
    );
    if (!staff) {
      throw new NotFoundException('No sos RPP de este evento');
    }

    const recentSales = staff.orders.map((order) => {
      const ticketsCount = order.orderItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      return {
        id: order.id,
        buyer: order.user.name,
        tickets: ticketsCount,
        price: Number(order.ticketAmount),
        // Fixed when the order was paid, not recalculated with today's rate.
        commission: Number(order.promoterCommission ?? 0),
        date: order.createdAt,
      };
    });

    const totalTicketsSold = recentSales.reduce(
      (acc, sale) => acc + sale.tickets,
      0,
    );

    return {
      staffId: staff.id,
      eventName: staff.event.title,
      totalEarned: Number(staff.totalEarned),
      totalTicketsSold,
      clicks: staff.clicks,
      recentSales,
    };
  }

  async getPublicPromoters(eventId: string) {
    if (!(await this.eventsRepository.isPublicEvent(eventId, new Date()))) {
      throw new NotFoundException('Evento no encontrado');
    }
    const staff = await this.eventsRepository.getEventStaffByEvent(eventId);
    // Return only PROMOTERs with their ID and Name for public use
    return staff
      .filter((s) => s.role === 'PROMOTER' && s.status === 'ACCEPTED')
      .map((s) => ({
        id: s.id,
        name: s.user.name,
      }));
  }

  async acceptInvitation(eventStaffId: string, userId: string) {
    await this.respondToInvitation(eventStaffId, userId, 'ACCEPTED');
    return { success: true, message: 'Invitación aceptada correctamente' };
  }

  async rejectInvitation(eventStaffId: string, userId: string) {
    await this.respondToInvitation(eventStaffId, userId, 'REJECTED');
    return { success: true, message: 'Invitación rechazada correctamente' };
  }

  // Only the invitee answers, and only once: the answer is a conditional update
  // on PENDING, so two answers at the same time can't both go through.
  private async respondToInvitation(
    eventStaffId: string,
    userId: string,
    status: InvitationAnswer,
  ) {
    const staff = await this.eventsRepository.findEventStaffById(eventStaffId);
    if (!staff || staff.userId !== userId) {
      throw new NotFoundException('Invitación no encontrada');
    }
    const answered = await this.eventsRepository.answerPendingInvitation(
      eventStaffId,
      status,
    );
    if (!answered) {
      throw new ConflictException('Esta invitación ya fue procesada.');
    }

    await this.notificationsService.updateStaffInviteStatus(
      userId,
      eventStaffId,
      status,
    );
    const accepted = status === 'ACCEPTED';
    await this.notificationsService.create({
      userId: staff.event.organizerId,
      type: 'SYSTEM',
      title: accepted ? 'Invitación aceptada' : 'Invitación rechazada',
      message: `${staff.user.name} ${accepted ? 'aceptó' : 'rechazó'} tu invitación para ser ${STAFF_ROLE_LABEL[staff.role]} en "${staff.event.title}".`,
      eventId: staff.event.id,
    });
  }
}
