import { BadRequestException, Injectable } from '@nestjs/common';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import {
  NewNotification,
  NotificationsRepository,
} from './repositories/notifications.repository';

// What the old full list (`GET /notifications`) still returns, for the tabs
// opened before the paginated feed existed.
const LEGACY_LIST_LIMIT = 50;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly notificationsRepository: NotificationsRepository,
  ) {}

  create(notification: NewNotification) {
    return this.notificationsRepository.create(notification);
  }

  findAllForUser(userId: string) {
    return this.notificationsRepository.findNewest(userId, LEGACY_LIST_LIMIT);
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
