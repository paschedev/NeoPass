import { Injectable } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SalesTotals } from '../sale-notices';

export type NewNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId?: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonObject;
};

// A notice that adds up while unread: it carries what this sale adds and how
// to word the new totals.
export type AddingNotice = {
  userId: string;
  openGroupKey: string;
  type: NotificationType;
  eventId: string;
  actionUrl: string;
  tickets: number;
  amount: Prisma.Decimal;
  describe: (totals: SalesTotals) => { title: string; message: string };
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
  activityAt: true,
} satisfies Prisma.NotificationSelect;

const NEWEST_FIRST: Prisma.NotificationOrderByWithRelationInput[] = [
  { activityAt: 'desc' },
  { id: 'desc' },
];

// Reading a notice closes its group: the next sale opens a new one.
const READ = { isRead: true, openGroupKey: null };

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create({ metadata, ...data }: NewNotification) {
    return this.prisma.notification.create({
      data: { ...data, metadata: metadata ?? Prisma.JsonNull },
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
      data: READ,
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: READ,
    });
  }

  // One notice per person holding valid tickets of the event (but not the
  // person who made the change), in one statement however many they are.
  // An unread change notice adds up: it keeps every kind of change it has
  // announced, and all of them are reworded with the event as it is now.
  notifyEventChange({
    eventId,
    actorId,
    changes,
    title,
    messages,
  }: {
    eventId: string;
    actorId: string;
    changes: { date: boolean; place: boolean };
    title: string;
    messages: { date: string; place: string; both: string };
  }) {
    const groupKey = `changes:${eventId}`;
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "Notification"
          ("id", "userId", "type", "title", "message", "eventId", "actionUrl",
           "metadata", "openGroupKey", "createdAt", "activityAt")
        SELECT gen_random_uuid()::text, holders."userId",
          'EVENT_UPDATE'::"NotificationType", ${title}, '', ${eventId},
          '/panel/tickets',
          jsonb_build_object('date', ${changes.date}::boolean,
                             'place', ${changes.place}::boolean),
          ${groupKey}, ${now}, ${now}
        FROM (
          SELECT DISTINCT t."userId"
          FROM "Ticket" t
          JOIN "TicketType" tt ON tt."id" = t."ticketTypeId"
          WHERE tt."eventId" = ${eventId}
            AND t."status" = 'VALID'
            AND t."userId" IS NOT NULL
            AND t."userId" <> ${actorId}
        ) holders
        ON CONFLICT ("userId", "openGroupKey") DO UPDATE SET
          "title" = EXCLUDED."title",
          "metadata" = jsonb_build_object(
            'date',
            ("Notification"."metadata"->>'date')::boolean OR ${changes.date}::boolean,
            'place',
            ("Notification"."metadata"->>'place')::boolean OR ${changes.place}::boolean),
          "activityAt" = EXCLUDED."activityAt"`;
      await tx.$executeRaw`
        UPDATE "Notification" SET "message" = CASE
          WHEN ("metadata"->>'date')::boolean AND ("metadata"->>'place')::boolean
            THEN ${messages.both}
          WHEN ("metadata"->>'date')::boolean THEN ${messages.date}
          ELSE ${messages.place}
        END
        WHERE "openGroupKey" = ${groupKey}`;
    });
  }

  // A paid order with who has to hear about it: the event's owner, its
  // co-organizers who can see sales, its promoter and its buyer.
  findOrderForSaleNotices(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        ticketAmount: true,
        promoterCommission: true,
        promoter: { select: { id: true, userId: true } },
        orderItems: {
          select: {
            quantity: true,
            ticketType: {
              select: {
                event: {
                  select: {
                    id: true,
                    title: true,
                    organizerId: true,
                    staff: {
                      where: {
                        role: 'MANAGER',
                        status: 'ACCEPTED',
                        permissions: { has: 'VIEW_SALES' },
                      },
                      select: { userId: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  // Each adding notice joins the person's unread one with the same key (or
  // opens it) atomically, so concurrent sales add up exactly; then its text
  // is rewritten with the new totals while the row is still locked. Sorted
  // so concurrent transactions lock rows in the same order.
  saveSaleNotices(adding: AddingNotice[], single: NewNotification[]) {
    const sorted = [...adding].sort((a, b) =>
      `${a.userId}:${a.openGroupKey}`.localeCompare(
        `${b.userId}:${b.openGroupKey}`,
      ),
    );
    // The app's clock, like Prisma's `now()` defaults: mixing it with the
    // database's would sort notices wrong if the clocks drift apart.
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      for (const notice of sorted) {
        const amount = notice.amount.toString();
        const [totals] = await tx.$queryRaw<
          { id: string; tickets: number; amount: string }[]
        >`
          INSERT INTO "Notification"
            ("id", "userId", "type", "title", "message", "eventId",
             "actionUrl", "metadata", "openGroupKey", "createdAt",
             "activityAt")
          VALUES (
            gen_random_uuid()::text, ${notice.userId},
            ${notice.type}::"NotificationType", '', '', ${notice.eventId},
            ${notice.actionUrl},
            jsonb_build_object('tickets', ${notice.tickets}::int,
                               'amount', ${amount}::numeric),
            ${notice.openGroupKey}, ${now}, ${now})
          ON CONFLICT ("userId", "openGroupKey") DO UPDATE SET
            "metadata" = jsonb_build_object(
              'tickets',
              ("Notification"."metadata"->>'tickets')::int + ${notice.tickets}::int,
              'amount',
              ("Notification"."metadata"->>'amount')::numeric + ${amount}::numeric),
            "activityAt" = EXCLUDED."activityAt"
          RETURNING "id",
            ("metadata"->>'tickets')::int AS "tickets",
            "metadata"->>'amount' AS "amount"`;
        await tx.notification.update({
          where: { id: totals.id },
          data: notice.describe({
            tickets: totals.tickets,
            amount: new Prisma.Decimal(totals.amount),
          }),
        });
      }
      await tx.notification.createMany({
        data: single.map(({ metadata, ...data }) => ({
          ...data,
          metadata: metadata ?? Prisma.JsonNull,
        })),
      });
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
