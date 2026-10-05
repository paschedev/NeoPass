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
import { ConfigService } from '@nestjs/config';
import {
  EventPermission,
  StaffRole,
  Prisma,
  TicketStatus,
} from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { buildRevenueChart } from './revenue-chart';
import { getBatchSaleStatus } from './batch-sale-status';
import { getEventPhase } from './event-phase';
import { buildEventSales } from './event-sales';
import { attendeesCsv, summarizeCheckIns } from './attendees';
import { toPaymentRecord } from './promoter-payment-record';
import { buildStaffOverview } from './staff-overview';
import { buildMyStaff } from './my-staff';
import { PromoterClicksService } from './promoter-clicks.service';
import { hasUsableMercadoPagoToken } from '../payments/mercadopago-token';
import { planBatchChanges } from './batch-changes';
import { isOwnFlyerUrl } from './flyer-url';
import { BatchSaleAction, planBatchSaleAction } from './batch-sale-action';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { BatchDto } from './dto/batch.dto';
import { EventLocationDto } from './dto/event-location.dto';
import { RegisterPromoterPaymentDto } from './dto/register-promoter-payment.dto';
import { ListAttendeesQueryDto } from './dto/list-attendees-query.dto';
import { AddStaffDto } from './dto/add-staff.dto';
import {
  coOrganizerTerms,
  describePermissions,
  permissionsError,
} from './co-organizers';
import { formatPesos } from '../common/amounts';
import {
  assertPermission,
  canDo,
  EventAccessService,
} from './event-access.service';
import {
  changedEventInfo,
  describeBatchChanges,
  statusChange,
} from './event-changes';

// Role names as the organizer reads them (errors and notices in their panel).
const STAFF_ROLE_LABEL: Record<StaffRole, string> = {
  PROMOTER: 'promotor',
  SCANNER: 'scanner',
  MANAGER: 'co-organizador',
};

// The invitee reads it first: "RPP" is what their panel is called.
const INVITED_ROLE_LABEL: Record<StaffRole, string> = {
  ...STAFF_ROLE_LABEL,
  PROMOTER: 'promotor (RPP)',
};

// A free ticket belongs to no account: its attendee is whoever it was sent to.
const toAttendee = (ticket: {
  status: TicketStatus;
  usedAt: Date | null;
  user: { name: string; email: string } | null;
  freeTicketGrant: {
    recipientName: string | null;
    recipientEmail: string;
  } | null;
  ticketType: { name: string; batch: { name: string } | null };
}) => ({
  name: ticket.user?.name ?? ticket.freeTicketGrant?.recipientName ?? null,
  email: ticket.user?.email ?? ticket.freeTicketGrant?.recipientEmail ?? null,
  ticketType: ticket.ticketType.name,
  batch: ticket.ticketType.batch?.name ?? null,
  status: ticket.status,
  checkedInAt: ticket.usedAt,
  freeTicket: ticket.freeTicketGrant !== null,
});

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
  venuePlaceId: string | null;
};

// The map location is both coordinates or none: a single one, or one cleared
// without the other, would leave the event pointing nowhere. A Google place
// comes with its point.
function assertCompleteLocation({
  latitude,
  longitude,
  venuePlaceId,
}: EventLocationDto) {
  const sent = [latitude, longitude].filter((value) => value !== undefined);
  const complete =
    sent.length === 0 ||
    (sent.length === 2 && (latitude === null) === (longitude === null));
  if (!complete) {
    throw new BadRequestException(
      'La ubicación en el mapa necesita latitud y longitud',
    );
  }
  if (venuePlaceId && (latitude == null || longitude == null)) {
    throw new BadRequestException(
      'El lugar elegido en el mapa necesita su latitud y longitud',
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
  'venuePlaceId',
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

type TeamEvent = NonNullable<Awaited<ReturnType<EventsRepository['findOne']>>>;

const hideSales = <T extends { sold: number; reserved: number }>({
  sold,
  reserved,
  ...ticketType
}: T) => ticketType;

// How many tickets were sold or reserved is part of the sales.
const withoutSales = (event: TeamEvent) => ({
  ...event,
  ticketTypes: event.ticketTypes.map(hideSales),
  ticketBatches: event.ticketBatches.map((batch) => ({
    ...batch,
    ticketTypes: batch.ticketTypes.map(hideSales),
  })),
});

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
  private readonly cloudinaryUrl: string;

  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationsService: NotificationsService,
    private readonly promoterClicks: PromoterClicksService,
    private readonly eventAccess: EventAccessService,
    config: ConfigService,
  ) {
    this.cloudinaryUrl = config.getOrThrow<string>('CLOUDINARY_URL');
  }

  private assertOwnFlyer(imageUrl: string | undefined) {
    if (
      imageUrl !== undefined &&
      !isOwnFlyerUrl(imageUrl, this.cloudinaryUrl)
    ) {
      throw new BadRequestException('Subí el flyer desde NeoPass');
    }
  }

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
    this.assertOwnFlyer(data.imageUrl);
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

  // The event in any status, for its owner or an accepted co-organizer with
  // the permission (when one is needed).
  private async findForTeam(
    id: string,
    userId: string,
    permission?: EventPermission,
  ) {
    const access = permission
      ? await this.eventAccess.assertCan(id, userId, permission)
      : await this.eventAccess.getAccess(id, userId);
    const event = await this.eventsRepository.findOne(id);
    if (!event) throw new NotFoundException('Evento no encontrado');
    return { access, event };
  }

  // For the edit and detail screens, with what the user can do on the event.
  async findOneForTeam(id: string, userId: string) {
    const { access, event } = await this.findForTeam(id, userId);
    const seesSales =
      canDo(access, 'VIEW_SALES') || canDo(access, 'MANAGE_BATCHES');
    return {
      ...(seesSales ? event : withoutSales(event)),
      access: {
        role: access.role,
        permissions: access.permissions,
        freeTicketLimit: access.freeTicketLimit,
      },
    };
  }

  async update(id: string, userId: string, changes: UpdateEventDto) {
    const { batches, ...eventData } = changes;
    const { access, event } = await this.findForTeam(id, userId);
    const infoChanges = changedEventInfo(event, changes);
    const batchChanges = batches
      ? describeBatchChanges(event.ticketBatches, batches)
      : [];
    if (infoChanges.length > 0) assertPermission(access, 'EDIT_EVENT');
    if (batchChanges.length > 0) assertPermission(access, 'MANAGE_BATCHES');
    if (statusChange(event, changes) && access.role !== 'OWNER') {
      throw new ForbiddenException(
        'Solo quien organiza el evento puede publicarlo o pasarlo a borrador',
      );
    }
    const now = new Date();
    const phase = assertEditable(event, now);
    this.assertOwnFlyer(changes.imageUrl);
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

  // Each event carries what was collected for its tickets (paid orders).
  async findByOrganizer(userId: string) {
    const [events, revenueByEvent] = await Promise.all([
      this.eventsRepository.findByOrganizer(userId),
      this.eventsRepository.sumPaidRevenueByEvent(userId),
    ]);
    return events.map((event) => ({
      ...event,
      revenue: (
        revenueByEvent.get(event.id) ?? new Prisma.Decimal(0)
      ).toNumber(),
    }));
  }

  // Sales detail of one event for its organizer: totals and each batch and
  // ticket type.
  async getEventSales(eventId: string, userId: string) {
    const { event } = await this.findForTeam(eventId, userId, 'VIEW_SALES');
    const [revenueByTicketType, checkedIn, refundedOrders] = await Promise.all([
      this.eventsRepository.sumPaidRevenueByTicketType(eventId),
      this.eventsRepository.countCheckedInTickets(eventId),
      this.eventsRepository.countRefundedOrders(eventId),
    ]);
    const { totals, batches } = buildEventSales(
      event,
      revenueByTicketType,
      new Date(),
    );
    return {
      event: {
        id: event.id,
        title: event.title,
        status: event.status,
        startDate: event.startDate,
        endDate: event.endDate,
        venueName: event.venueName,
        venueAddress: event.venueAddress,
      },
      totals: { ...totals, checkedIn, refundedOrders },
      batches,
    };
  }

  async updateBatches(
    eventId: string,
    userId: string,
    batchesData: BatchDto[],
  ) {
    const { event: eventContext } = await this.findForTeam(
      eventId,
      userId,
      'MANAGE_BATCHES',
    );
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
    userId: string,
    batchId: string,
    action: BatchSaleAction,
  ) {
    const { event } = await this.findForTeam(eventId, userId, 'MANAGE_BATCHES');
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

  // The organizer's staff by event, with what is owed to each promoter, to
  // each event and in total. Only the organizer's own events: upcoming ones
  // even without staff (they may need it) and closed ones that had staff.
  async getStaffOverview(organizerId: string) {
    const now = new Date();
    const [events, soldByPromoter] = await Promise.all([
      this.eventsRepository.findStaffOverviewEvents(organizerId, now),
      this.eventsRepository.sumTicketsSoldByPromoter({ organizerId }),
    ]);
    return buildStaffOverview(events, soldByPromoter, now);
  }

  // Where the person in session works as staff, from their own roles only.
  async getMyStaff(userId: string) {
    const [assignments, soldByPromoter] = await Promise.all([
      this.eventsRepository.findMyStaffAssignments(userId),
      this.eventsRepository.sumTicketsSoldByPromoter({ userId }),
    ]);
    return buildMyStaff(assignments, soldByPromoter, new Date());
  }

  async addStaff(
    eventId: string,
    userId: string,
    {
      userId: inviteeId,
      role,
      commissionType,
      commissionValue,
      permissions,
      freeTicketLimit,
    }: AddStaffDto,
  ) {
    const { access, event } = await this.findForTeam(
      eventId,
      userId,
      'MANAGE_STAFF',
    );
    if (role === 'MANAGER' && access.role !== 'OWNER') {
      throw new ForbiddenException(
        'Solo quien organiza el evento puede invitar co-organizadores',
      );
    }
    // Nobody can work an event that is over: a promoter couldn't sell anymore.
    if (getEventPhase(event, new Date()) === 'CLOSED') {
      throw new ConflictException(
        event.status === 'CANCELLED'
          ? 'El evento está cancelado: no se puede sumar staff'
          : 'El evento ya terminó: no se puede sumar staff',
      );
    }

    // Only promoters earn a commission and only co-organizers have
    // permissions: for the other roles they are ignored.
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
    const coOrganizer =
      role === 'MANAGER'
        ? coOrganizerTerms(permissions ?? [], freeTicketLimit)
        : null;
    const permissionsProblem =
      coOrganizer && permissionsError(coOrganizer.permissions);
    if (permissionsProblem) throw new BadRequestException(permissionsProblem);

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

    let terms = '';
    if (role === 'PROMOTER' && commissionType && commissionValue) {
      terms =
        commissionType === 'PERCENTAGE'
          ? `, con ${commissionValue}% de comisión por entrada`
          : `, con $${commissionValue} de comisión por entrada`;
    }
    const willDo =
      coOrganizer &&
      describePermissions(coOrganizer.permissions, coOrganizer.freeTicketLimit);

    const staff = await this.eventsRepository.saveStaffInvitation(
      existing?.id ?? null,
      {
        eventId,
        userId: user.id,
        role,
        ...commissionTerms,
        ...coOrganizer,
      },
      coOrganizer
        ? {
            eventId,
            actorId: userId,
            type: 'CO_ORGANIZER_INVITED',
            summary: `Invitó a ${user.name} a co-organizar. Va a poder ${willDo}.`,
          }
        : {
            eventId,
            actorId: userId,
            type: 'STAFF_INVITED',
            summary: `Invitó a ${user.name} como ${INVITED_ROLE_LABEL[role]}${terms}.`,
          },
    );

    const again = existing ? ' de nuevo' : '';
    await this.notificationsService.create({
      userId: user.id,
      type: 'STAFF_INVITE',
      title: 'Nueva invitación',
      message: coOrganizer
        ? `Te invitaron${again} como co-organizador al evento "${event.title}". Vas a poder ${willDo}.`
        : `Te invitaron${again} como ${INVITED_ROLE_LABEL[role]} al evento "${event.title}"${terms}.`,
      eventId: event.id,
      metadata: {
        eventStaffId: staff.id,
        role,
        ...commissionTerms,
        ...coOrganizer,
        status: 'PENDING',
      },
    });

    return staff;
  }

  // Holders of the event's tickets, as the organizer decided to see them: name
  // and email of whoever holds each ticket now.
  async getEventAttendees(
    eventId: string,
    userId: string,
    { q, page, limit }: ListAttendeesQueryDto,
  ) {
    await this.eventAccess.assertCan(eventId, userId, 'VIEW_ATTENDEES');
    const { items, total } = await this.eventsRepository.findEventAttendees(
      eventId,
      { search: q?.trim() || undefined, skip: (page - 1) * limit, take: limit },
    );
    return {
      items: items.map(({ id, ...ticket }) => ({
        ticketId: id,
        ...toAttendee(ticket),
      })),
      total,
      page,
      limit,
    };
  }

  async exportEventAttendees(eventId: string, userId: string) {
    await this.eventAccess.assertCan(eventId, userId, 'VIEW_ATTENDEES');
    const tickets = await this.eventsRepository.findAllEventAttendees(eventId);
    return attendeesCsv(tickets.map(toAttendee));
  }

  // Every co-organizer scans, so they all see who got in.
  async getEventCheckIns(eventId: string, userId: string) {
    await this.eventAccess.getAccess(eventId, userId);
    const [ticketTypes, counts] = await Promise.all([
      this.eventsRepository.findEventTicketTypes(eventId),
      this.eventsRepository.countTicketsByTypeAndStatus(eventId),
    ]);
    return summarizeCheckIns(ticketTypes, counts);
  }

  // Promoters of the event with what they sold, earned and were paid. The
  // payments happen outside NeoPass: the organizer records them here.
  async getEventPromoters(eventId: string, userId: string) {
    await this.eventAccess.assertCan(eventId, userId, 'MANAGE_STAFF');
    const promoters = await this.eventsRepository.findEventPromoters(eventId);
    return promoters.map(
      ({ user, orders, payments, totalEarned, totalPaid, ...promoter }) => ({
        id: promoter.id,
        status: promoter.status,
        name: user.name,
        email: user.email,
        commissionType: promoter.commissionType,
        commissionValue: promoter.commissionValue?.toNumber() ?? null,
        ticketsSold: orders
          .flatMap((order) => order.orderItems)
          .reduce((sum, item) => sum + item.quantity, 0),
        salesAmount: Prisma.Decimal.sum(
          0,
          ...orders.map((order) => order.ticketAmount),
        ).toNumber(),
        totalEarned: totalEarned.toNumber(),
        totalPaid: totalPaid.toNumber(),
        balance: totalEarned.minus(totalPaid).toNumber(),
        payments: payments.map(toPaymentRecord),
      }),
    );
  }

  async registerPromoterPayment(
    eventId: string,
    userId: string,
    staffId: string,
    { amount, note }: RegisterPromoterPaymentDto,
  ) {
    await this.eventAccess.assertCan(eventId, userId, 'MANAGE_STAFF');
    const promoter = await this.eventsRepository.findEventPromoterTotals(
      eventId,
      staffId,
    );
    if (!promoter) throw new NotFoundException('RPP no encontrado');

    const recorded = await this.eventsRepository.registerPromoterPayment({
      eventStaffId: staffId,
      amount: new Prisma.Decimal(amount),
      note: note ?? null,
      registeredById: userId,
    });
    if (!recorded) {
      // Read again: another payment may have just taken the balance.
      const current = await this.eventsRepository.findEventPromoterTotals(
        eventId,
        staffId,
      );
      const balance = current
        ? current.totalEarned.minus(current.totalPaid).toNumber()
        : 0;
      throw new ConflictException(
        `El pago supera lo que se le debe (${formatPesos(Math.max(0, balance))})`,
      );
    }
    return {
      ...toPaymentRecord(recorded.payment),
      totalPaid: recorded.totalPaid.toNumber(),
      balance: recorded.totalEarned.minus(recorded.totalPaid).toNumber(),
    };
  }

  async getEventStaff(eventId: string, userId: string) {
    await this.eventAccess.assertCan(eventId, userId, 'MANAGE_STAFF');
    return this.eventsRepository.getEventStaffByEvent(eventId);
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
      totalPaid: staff.totalPaid.toNumber(),
      balance: staff.totalEarned.minus(staff.totalPaid).toNumber(),
      payments: staff.payments.map(toPaymentRecord),
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
