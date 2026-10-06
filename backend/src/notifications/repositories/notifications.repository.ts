import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonObject;
};

const FEED_FIELDS = {
  id: true,
  type: true,
  title: true,
  message: true,
  isRead: true,
  eventId: true,
  actionUrl: true,
  metadata: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

const NEWEST_FIRST: Prisma.NotificationOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create({ metadata, ...data }: NewNotification) {
    return this.prisma.notification.create({
      data: { ...data, metadata: metadata ?? Prisma.JsonNull },
    });
  }

  findNewest(userId: string, take: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: NEWEST_FIRST,
      take,
    });
  }

  async belongsTo(id: string, userId: string) {
    const found = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    return found !== null;
  }

  // One page, newest first, starting after `cursor`; `take` one more than the
  // page to know whether there is another.
  findPage(
    userId: string,
    {
      cursor,
      take,
      type,
    }: { cursor?: string; take: number; type?: NotificationType },
  ) {
    return this.prisma.notification.findMany({
      where: { userId, type },
      orderBy: NEWEST_FIRST,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: FEED_FIELDS,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, isRead: false } });
  }

  markAsRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }

  // The invitation's notice keeps the answer and stops counting as new.
  markStaffInviteAnswered(
    userId: string,
    eventStaffId: string,
    status: 'ACCEPTED' | 'REJECTED',
  ) {
    return this.prisma.$executeRaw`
      UPDATE "Notification"
      SET "isRead" = true,
          "metadata" = jsonb_set("metadata", '{status}', to_jsonb(${status}::text))
      WHERE "userId" = ${userId}
        AND "type" = 'STAFF_INVITE'
        AND "metadata"->>'eventStaffId' = ${eventStaffId}`;
  }
}
