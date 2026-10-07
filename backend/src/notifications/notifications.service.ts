import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  AddingNotice,
  NewNotification,
  NotificationsRepository,
} from './repositories/notifications.repository';
import {
  ChangedEvent,
  eventChangeNotice,
  EventChanges,
} from './event-change-notices';
import {
  eventSalesNotice,
  promoterSalesNotice,
  purchaseNotice,
} from './sale-notices';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  create(notification: NewNotification) {
    return this.notificationsRepository.create(notification);
  }

  // After an order is paid: the event's owner and its co-organizers who can
  // see sales hear about it, and so does the promoter whose link sold it
  // (both notices add up while unread); the buyer gets their confirmation.
  async notifyPaidOrder(orderId: string) {
    const order =
      await this.notificationsRepository.findOrderForSaleNotices(orderId);
    const event = order?.orderItems[0]?.ticketType.event;
    if (!order || !event) return;

    const tickets = order.orderItems.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    const sellers = new Set([
      event.organizerId,
      ...event.staff.map((member) => member.userId),
    ]);
    const adding: AddingNotice[] = [...sellers].map((userId) => ({
      userId,
      openGroupKey: `sales:${event.id}`,
      type: 'EVENT_SALES',
      eventId: event.id,
      actionUrl: `/panel/eventos/${event.id}`,
      tickets,
      amount: order.ticketAmount,
      describe: (totals) => eventSalesNotice(event.title, totals),
    }));
    if (order.promoter) {
      adding.push({
        userId: order.promoter.userId,
        openGroupKey: `promoter-sales:${order.promoter.id}`,
        type: 'PROMOTER_SALE',
        eventId: event.id,
        actionUrl: `/panel/rpp/${event.id}`,
        tickets,
        amount: order.promoterCommission ?? new Prisma.Decimal(0),
        describe: (totals) => promoterSalesNotice(event.title, totals),
      });
    }

    await this.notificationsRepository.saveSaleNotices(adding, [
      {
        userId: order.userId,
        type: 'TICKET_PURCHASE',
        eventId: event.id,
        actionUrl: '/panel/tickets',
        ...purchaseNotice(event.title, tickets),
      },
    ]);
  }

  // After a published event changes date or place, whoever holds tickets
  // hears about it (not the person who changed it).
  notifyEventChange(
    event: ChangedEvent & { id: string },
    actorId: string,
    changes: EventChanges,
  ) {
    const notice = (kinds: EventChanges) => eventChangeNotice(event, kinds);
    return this.notificationsRepository.notifyEventChange({
      eventId: event.id,
      actorId,
      changes,
      title: notice(changes).title,
      messages: {
        date: notice({ date: true, place: false }).message,
        place: notice({ date: false, place: true }).message,
        both: notice({ date: true, place: true }).message,
      },
    });
  }

  async findFeed(
    userId: string,
    { cursor, limit, onlyRequests }: ListNotificationsQueryDto,
  ) {
    if (
      cursor &&
      !(await this.notificationsRepository.belongsTo(cursor, userId))
    ) {
      throw new BadRequestException(
        'No pudimos seguir cargando los avisos. Recargá la página.',
      );
    }
    const [rows, unreadCount] = await Promise.all([
      this.notificationsRepository.findPage(userId, {
        cursor,
        take: limit + 1,
        type: onlyRequests ? 'STAFF_INVITE' : undefined,
      }),
      this.notificationsRepository.countUnread(userId),
    ]);
    const items = rows.slice(0, limit);
    return {
      items,
      nextCursor: rows.length > limit ? items[items.length - 1].id : null,
      unreadCount,
    };
  }

  markAsRead(id: string, userId: string) {
    return this.notificationsRepository.markAsRead(id, userId);
  }

  markAllAsRead(userId: string) {
    return this.notificationsRepository.markAllAsRead(userId);
  }

  delete(id: string, userId: string) {
    return this.notificationsRepository.delete(id, userId);
  }

  async updateStaffInviteStatus(
    userId: string,
    eventStaffId: string,
    status: 'ACCEPTED' | 'REJECTED',
  ) {
    await this.notificationsRepository.markStaffInviteAnswered(
      userId,
      eventStaffId,
      status,
    );
  }
}
