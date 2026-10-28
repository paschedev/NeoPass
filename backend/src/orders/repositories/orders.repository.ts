import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import type { CheckoutOrderItem } from '../checkout-order';

export type PendingOrder = {
  userId: string;
  ticketAmount: Prisma.Decimal;
  serviceFee: Prisma.Decimal;
  marketplaceFee: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  promoterId?: string;
  expiresAt: Date;
  items: CheckoutOrderItem[];
  // The organizer whose balance with NeoPass this sale may collect.
  organizerId: string;
};

// What the sale collects, given the organizer's balance and what their other
// unpaid sales already reserved of it.
export type FeeAdjustmentOf = (
  balance: Prisma.Decimal,
  reserved: Prisma.Decimal,
) => Prisma.Decimal;

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
                id: true,
                mercadoPagoAccessToken: true,
                mercadoPagoTokenExpiresAt: true,
                mercadoPagoFeeRate: true,
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
  // The organizer's row is locked first (as payments and refunds do, so they
  // can't deadlock): two checkouts can't reserve the same balance. The
  // adjustment goes on top of NeoPass's share.
  async createPendingOrder(
    { items, organizerId, ...order }: PendingOrder,
    feeAdjustmentOf: FeeAdjustmentOf,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const [organizer] = await tx.$queryRaw<
        { mercadoPagoFeeBalance: Prisma.Decimal }[]
      >`SELECT "mercadoPagoFeeBalance" FROM "User" WHERE id = ${organizerId} FOR UPDATE`;
      const reserved = await tx.order.aggregate({
        _sum: { feeAdjustment: true },
        where: {
          status: 'PENDING',
          feeAdjustment: { gt: 0 },
          orderItems: { some: { ticketType: { event: { organizerId } } } },
        },
      });
      const feeAdjustment = feeAdjustmentOf(
        organizer.mercadoPagoFeeBalance,
        reserved._sum.feeAdjustment ?? new Prisma.Decimal(0),
      );

      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { increment: item.quantity } },
        });
      }
      return tx.order.create({
        data: {
          ...order,
          feeAdjustment,
          marketplaceFee: order.marketplaceFee.add(feeAdjustment),
          status: 'PENDING',
          orderItems: { create: items },
        },
        select: { id: true, marketplaceFee: true },
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
