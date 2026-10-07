import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import type { CheckoutOrderItem } from '../checkout-order';

export type PendingOrder = {
  userId: string;
  ticketAmount: Prisma.Decimal;
  serviceFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  promoterId?: string;
  expiresAt: Date;
  items: CheckoutOrderItem[];
};

@Injectable()
export class OrdersRepository {
  constructor(private prisma: PrismaService) {}

  async findTicketTypesForCheckout(ticketTypeIds: string[]) {
    return this.prisma.ticketType.findMany({
      where: { id: { in: ticketTypeIds } },
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
        sold: true,
        reserved: true,
        batch: { select: { isVisible: true, publishAt: true, closeAt: true } },
        event: {
          select: {
            id: true,
            title: true,
            status: true,
            endDate: true,
            deletedAt: true,
            neoPassFeePercentage: true,
            organizer: {
              select: {
                mercadoPagoAccessToken: true,
                mercadoPagoTokenExpiresAt: true,
              },
            },
          },
        },
      },
    });
  }

  async findAcceptedPromoter(promoterId: string, eventId: string) {
    return this.prisma.eventStaff.findFirst({
      where: {
        id: promoterId,
        eventId,
        role: 'PROMOTER',
        status: 'ACCEPTED',
      },
      select: { id: true },
    });
  }

  // Reserves the tickets and creates the order in PENDING. If another purchase
  // took the last tickets in the meantime, the stock CHECK aborts it all.
  async createPendingOrder({ items, ...order }: PendingOrder) {
    return this.prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { increment: item.quantity } },
        });
      }
      return tx.order.create({
        data: { ...order, status: 'PENDING', orderItems: { create: items } },
        select: { id: true },
      });
    });
  }

  // PENDING → EXPIRED or CANCELLED, releasing the reservation. Conditional on
  // PENDING: a payment or a concurrent job that already moved the order makes
  // this a no-op, so the reservation is released exactly once. Returns whether
  // the order was released.
  async releasePendingOrder(
    orderId: string,
    status: Extract<OrderStatus, 'EXPIRED' | 'CANCELLED'>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status },
      });
      if (count === 0) return false;

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { decrement: item.quantity } },
        });
      }
      return true;
    });
  }
}
