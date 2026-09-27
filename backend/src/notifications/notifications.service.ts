import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    eventId?: string;
    actionUrl?: string;
    metadata?: any;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        eventId: data.eventId,
        actionUrl: data.actionUrl,
        metadata: data.metadata
          ? (data.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
  }

  async findAllForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(id: string, userId: string) {
    // Only allow marking their own notifications as read
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({
      where: { id, userId },
    });
  }

  async updateStaffInviteStatus(
    userId: string,
    eventStaffId: string,
    status: 'ACCEPTED' | 'REJECTED',
  ) {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, type: 'STAFF_INVITE' },
    });
    for (const n of notifications) {
      if (n.metadata && (n.metadata as any).eventStaffId === eventStaffId) {
        const updatedMetadata = { ...(n.metadata as any), status };
        await this.prisma.notification.update({
          where: { id: n.id },
          data: { metadata: updatedMetadata, isRead: true },
        });
      }
    }
  }
}
