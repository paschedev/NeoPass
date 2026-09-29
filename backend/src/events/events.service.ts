import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EventsRepository } from './repositories/events.repository';
import { UserRepository } from '../auth/repositories/user.repository';
import { Prisma, StaffRole, CommissionType } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { buildRevenueChart } from './revenue-chart';
import { getBatchSaleStatus } from './batch-sale-status';

type EventDates = { startDate: string; endDate: string };

function assertEndAfterStart(startDate: Date, endDate: Date) {
  if (endDate <= startDate) {
    throw new BadRequestException(
      'La fecha de fin tiene que ser posterior a la de inicio',
    );
  }
}

type ExistingBatch = { id: string; ticketTypes: { id: string }[] };
type IncomingBatch = { id?: string; ticketTypes?: { id?: string }[] };
type ExistingBatchWithSales = {
  ticketTypes: { id: string; name: string; sold: number; reserved: number }[];
};
type IncomingBatchWithStock = {
  ticketTypes?: { id?: string; stock: number }[];
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
  incoming: IncomingBatch[] = [],
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
    const hasForeignType = batch.ticketTypes?.some(
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
  ) {}

  async findPublicPage(page: number, limit: number) {
    const { items, total } = await this.eventsRepository.findPublicPage(
      new Date(),
      (page - 1) * limit,
      limit,
    );
    return { items, total, page, limit };
  }

  async findOne(id: string, rppId?: string) {
    if (rppId) {
      // Fire and forget (no esperamos para no bloquear la respuesta)
      this.eventsRepository
        .incrementPromoterClicks(rppId)
        .catch((err) => console.error('Error tracking click', err));
    }
    // Drafts, cancelled and finished events are not public; organizers use
    // GET /events/organizer/:id instead.
    const event = await this.eventsRepository.findPublicById(id, new Date());
    if (!event) throw new NotFoundException('Evento no encontrado');

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

  async create(userId: string, data: any) {
    const { batches, ...eventData } = data;
    const user = await this.userRepository.findById(userId);

    if (!user) throw new BadRequestException('Usuario no encontrado');
    if (!user.mercadoPagoAccessToken) {
      throw new BadRequestException(
        'Debes vincular Mercado Pago antes de crear un evento',
      );
    }
    assertOwnBatchIds([], batches);
    const dates = data as EventDates;
    const startDate = new Date(dates.startDate);
    if (startDate <= new Date()) {
      throw new BadRequestException('La fecha de inicio tiene que ser futura');
    }
    const endDate = new Date(dates.endDate);
    assertEndAfterStart(startDate, endDate);
    assertBatchWindows(batches ?? [], [], endDate, new Date());

    return this.eventsRepository.createWithBatches(
      { ...eventData, organizerId: userId },
      batches ?? [],
    );
  }

  // For the organizer's own screens (edit, preview): any status, owner only.
  async findOneForOrganizer(id: string, organizerId: string) {
    const event = await this.eventsRepository.findOne(id);
    if (!event) throw new NotFoundException('Evento no encontrado');
    if (event.organizerId !== organizerId) {
      throw new ForbiddenException('No tenés permiso sobre este evento');
    }
    return event;
  }

  async update(id: string, organizerId: string, data: any) {
    const { batches, ...eventData } = data;
    const event = await this.eventsRepository.findOne(id);
    if (!event || event.organizerId !== organizerId) {
      throw new ForbiddenException('No tienes permiso para editar este evento');
    }
    if (event.status === 'FINISHED') {
      throw new ConflictException('Un evento finalizado no se puede editar');
    }
    const dates = data as Partial<EventDates>;
    const endDate = dates.endDate ? new Date(dates.endDate) : event.endDate;
    assertEndAfterStart(
      dates.startDate ? new Date(dates.startDate) : event.startDate,
      endDate,
    );
    assertOwnBatchIds(event.ticketBatches, batches);
    // Without batches in the body, the stored ones still have to fit the event.
    assertBatchWindows(
      batches ?? event.ticketBatches,
      event.ticketBatches,
      endDate,
      new Date(),
    );
    if (!batches) return this.eventsRepository.update(id, eventData);

    await this.assertBatchChangesAllowed(event.ticketBatches, batches);
    return this.eventsRepository.updateWithBatches(
      id,
      eventData,
      batches,
      event,
    );
  }

  async findByOrganizer(userId: string) {
    return this.eventsRepository.findByOrganizer(userId);
  }

  async updateBatches(
    eventId: string,
    organizerId: string,
    batchesData: any[],
  ) {
    const eventContext = await this.eventsRepository.findOne(eventId);

    if (!eventContext || eventContext.organizerId !== organizerId) {
      throw new ForbiddenException('No tienes permiso sobre este evento');
    }
    assertOwnBatchIds(eventContext.ticketBatches, batchesData);
    assertBatchWindows(
      batchesData,
      eventContext.ticketBatches,
      eventContext.endDate,
      new Date(),
    );
    await this.assertBatchChangesAllowed(
      eventContext.ticketBatches,
      batchesData,
    );

    return this.eventsRepository.updateBatchesTransaction(
      eventId,
      batchesData,
      eventContext,
    );
  }

  // Sold and reserved tickets keep their place in the stock, and a ticket type
  // with orders or tickets can't be deleted: they still point to it.
  private async assertBatchChangesAllowed(
    existing: ExistingBatchWithSales[],
    incoming: IncomingBatchWithStock[],
  ) {
    const incomingStock = new Map<string, number>();
    for (const batch of incoming) {
      for (const ticketType of batch.ticketTypes ?? []) {
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

    let totalSold = 0;
    let totalRevenue = 0;

    // Calculate totals for ALL time based on ticketTypes.sold
    events.forEach((event) => {
      event.ticketTypes.forEach((tt) => {
        totalSold += tt.sold;
        totalRevenue += tt.sold * Number(tt.price);
      });
    });

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
      totalRevenue: totalRevenue,
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
    const event = await this.eventsRepository.findOne(eventId);
    if (!event || event.organizerId !== organizerId) {
      throw new BadRequestException('No tienes permiso sobre este evento');
    }

    const user = await this.userRepository.findById(inviteeId);
    if (!user) {
      throw new BadRequestException(
        'Usuario no registrado. Pídele que se registre en NeoPass primero.',
      );
    }

    // Verificar si ya existe para este rol específico
    const existing = await this.eventsRepository.findEventStaff(
      eventId,
      user.id,
      role,
    );

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new BadRequestException(
          `El usuario ya tiene una invitación pendiente para el rol de ${role} en este evento.`,
        );
      }
      if (existing.status === 'ACCEPTED') {
        throw new BadRequestException(
          `El usuario ya es ${role} de este evento.`,
        );
      }
      if (existing.status === 'REJECTED') {
        // Re-invitar: pasar a PENDING y despachar notificación
        const staff = await this.eventsRepository.updateEventStaff(
          existing.id,
          { status: 'PENDING', commissionType, commissionValue },
        );
        let commString = '';
        if (role === 'PROMOTER' && commissionType && commissionValue) {
          commString =
            commissionType === 'PERCENTAGE'
              ? ` (${commissionValue}% por ticket)`
              : ` ($${commissionValue} por ticket)`;
        }

        await this.notificationsService.create({
          userId: user.id,
          type: 'STAFF_INVITE',
          title: `Nueva invitación de Staff`,
          message: `Has sido invitado nuevamente como ${role === 'PROMOTER' ? 'Relaciones Públicas' : 'Escáner'} para el evento "${event.title}".${commString}`,
          eventId: event.id,
          metadata: {
            eventStaffId: staff.id,
            role,
            commissionType,
            commissionValue,
            status: 'PENDING',
          },
        });
        return staff;
      }
    }

    const staff = await this.eventsRepository.createEventStaff({
      event: { connect: { id: eventId } },
      user: { connect: { id: user.id } },
      role,
      commissionType,
      commissionValue,
    });

    let commString = '';
    if (role === 'PROMOTER' && commissionType && commissionValue) {
      commString =
        commissionType === 'PERCENTAGE'
          ? ` (${commissionValue}% por ticket)`
          : ` ($${commissionValue} por ticket)`;
    }

    await this.notificationsService.create({
      userId: user.id,
      type: 'STAFF_INVITE',
      title: `Nueva invitación de Staff`,
      message: `Has sido invitado como ${role === 'PROMOTER' ? 'Relaciones Públicas' : 'Escáner'} para el evento "${event.title}".${commString}`,
      eventId: event.id,
      metadata: {
        eventStaffId: staff.id,
        role,
        commissionType,
        commissionValue,
        status: 'PENDING',
      },
    });

    return staff;
  }

  async getEventStaff(eventId: string, organizerId: string) {
    const event = await this.eventsRepository.findOne(eventId);
    if (!event || event.organizerId !== organizerId) {
      throw new BadRequestException('No tienes permiso sobre este evento');
    }
    return this.eventsRepository.getEventStaffByEvent(eventId);
  }

  async getMyPromoterStats(userId: string) {
    const assignments = await this.eventsRepository.getPromoterStats(userId);

    const totalEarned = assignments.reduce(
      (acc, curr) => acc + Number(curr.totalEarned),
      0,
    );
    const totalPaid = assignments.reduce(
      (acc, curr) => acc + Number(curr.totalPaid),
      0,
    );
    const totalTicketsSold = assignments.reduce(
      (acc, curr) => acc + curr.totalTicketsSold,
      0,
    );

    return {
      isPromoter: assignments.length > 0,
      totalEarned,
      totalPaid,
      totalTicketsSold,
      pendingBalance: totalEarned - totalPaid,
      events: assignments,
    };
  }

  async getPromoterEventStats(userId: string, eventId: string) {
    const staff = await this.eventsRepository.getPromoterStatsForEvent(
      userId,
      eventId,
    );
    if (!staff) {
      throw new BadRequestException('No eres promotor de este evento');
    }

    const recentSales = staff.orders.map((order) => {
      const ticketsCount = order.orderItems.reduce(
        (acc, item) => acc + item.quantity,
        0,
      );

      // Calculate order commission based on staff commission settings
      let orderCommission = 0;
      if (staff.commissionType === 'PERCENTAGE' && staff.commissionValue) {
        orderCommission =
          (Number(order.ticketAmount) * Number(staff.commissionValue)) / 100;
      } else if (staff.commissionType === 'FIXED' && staff.commissionValue) {
        orderCommission = ticketsCount * Number(staff.commissionValue);
      }

      return {
        id: order.id,
        buyer: order.user.name,
        tickets: ticketsCount,
        price: Number(order.ticketAmount),
        commission: orderCommission,
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
    const staff = await this.eventsRepository.findEventStaffById(eventStaffId);
    if (!staff || staff.userId !== userId) {
      throw new BadRequestException(
        'Invitación no encontrada o no tienes permiso.',
      );
    }
    if (staff.status !== 'PENDING') {
      throw new BadRequestException('Esta invitación ya fue procesada.');
    }

    await this.eventsRepository.updateEventStaff(eventStaffId, {
      status: 'ACCEPTED',
    });
    await this.notificationsService.updateStaffInviteStatus(
      userId,
      eventStaffId,
      'ACCEPTED',
    );

    await this.notificationsService.create({
      userId: staff.event.organizerId,
      type: 'SYSTEM',
      title: 'Invitación Aceptada',
      message: `${staff.user.name} ha aceptado tu invitación para ser ${staff.role === 'PROMOTER' ? 'Relaciones Públicas' : 'Escáner'} en "${staff.event.title}".`,
      eventId: staff.event.id,
    });

    return { success: true, message: 'Invitación aceptada correctamente' };
  }

  async rejectInvitation(eventStaffId: string, userId: string) {
    const staff = await this.eventsRepository.findEventStaffById(eventStaffId);
    if (!staff || staff.userId !== userId) {
      throw new BadRequestException(
        'Invitación no encontrada o no tienes permiso.',
      );
    }
    if (staff.status !== 'PENDING') {
      throw new BadRequestException('Esta invitación ya fue procesada.');
    }

    await this.eventsRepository.updateEventStaff(eventStaffId, {
      status: 'REJECTED',
    });
    await this.notificationsService.updateStaffInviteStatus(
      userId,
      eventStaffId,
      'REJECTED',
    );

    await this.notificationsService.create({
      userId: staff.event.organizerId,
      type: 'SYSTEM',
      title: 'Invitación Rechazada',
      message: `${staff.user.name} ha rechazado tu invitación para ser ${staff.role === 'PROMOTER' ? 'Relaciones Públicas' : 'Escáner'} en "${staff.event.title}".`,
      eventId: staff.event.id,
    });

    return { success: true, message: 'Invitación rechazada correctamente' };
  }
}
