import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import type { MercadoPagoCredentials } from '../mercadopago-token';

@Injectable()
export class PaymentsRepository {
  constructor(private prisma: PrismaService) {}

  async updateUserMercadoPagoCredentials(
    userId: string,
    credentials: MercadoPagoCredentials,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: credentials,
    });
  }

  // Oldest expiry first; the daily renewal picks up whatever is left the next day.
  async findMercadoPagoTokensExpiringBefore(limit: Date) {
    const organizers = await this.prisma.user.findMany({
      where: {
        mercadoPagoRefreshToken: { not: null },
        mercadoPagoTokenExpiresAt: { lte: limit },
      },
      select: { id: true, mercadoPagoRefreshToken: true },
      orderBy: { mercadoPagoTokenExpiresAt: 'asc' },
      take: 100,
    });
    return organizers.flatMap(({ id, mercadoPagoRefreshToken }) =>
      mercadoPagoRefreshToken
        ? [{ id, refreshToken: mercadoPagoRefreshToken }]
        : [],
    );
  }

  // Only if the refresh token is still the one that was used: a concurrent
  // renewal (or a new link) already stored newer credentials.
  async replaceMercadoPagoCredentials(
    userId: string,
    usedRefreshToken: string,
    credentials: MercadoPagoCredentials,
  ) {
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, mercadoPagoRefreshToken: usedRefreshToken },
      data: credentials,
    });
    return count > 0;
  }

  async findMercadoPagoTokenByUserId(mercadoPagoUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { mercadoPagoUserId },
      select: { mercadoPagoAccessToken: true },
    });
    return user?.mercadoPagoAccessToken ?? null;
  }

  async findPaymentByProviderId(providerPaymentId: string) {
    return this.prisma.payment.findFirst({
      where: { providerPaymentId },
    });
  }

  async findOrderForPayment(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        payment: { select: { id: true } },
        orderItems: {
          take: 1,
          select: {
            ticketType: {
              select: { event: { select: { id: true, organizerId: true } } },
            },
          },
        },
      },
    });
  }

  // Moves the order from `fromStatus` to PAID only if it is still in that
  // status, so concurrent webhooks or an expiration cannot apply it twice.
  // Returns false if the status changed in the meantime. A late payment
  // (EXPIRED/CANCELLED) no longer has a reservation: it only adds to `sold`,
  // and the stock CHECK aborts the transaction if there are no tickets left.
  async payOrderTransaction(
    orderId: string,
    fromStatus: OrderStatus,
    payment: { providerPaymentId: string; amount: number },
    generateTicketsCallback: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: fromStatus },
        data: { status: 'PAID' },
      });
      if (count === 0) return false;

      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { orderItems: true },
      });
      const hadReservation = fromStatus === 'PENDING';
      for (const item of order.orderItems) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: hadReservation
            ? {
                reserved: { decrement: item.quantity },
                sold: { increment: item.quantity },
              }
            : { sold: { increment: item.quantity } },
        });
      }

      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: 'MERCADO_PAGO',
          providerPaymentId: payment.providerPaymentId,
          status: 'APPROVED',
          amount: payment.amount,
        },
      });

      // Execute callback to generate tickets
      await generateTicketsCallback(tx);

      // Calculate promoter commission if a promoter is linked
      if (order.promoterId) {
        const promoter = await tx.eventStaff.findUnique({
          where: { id: order.promoterId },
        });
        if (promoter) {
          let commission = 0;
          if (promoter.commissionType === 'FIXED' && promoter.commissionValue) {
            const ticketCount = order.orderItems.reduce(
              (acc, curr) => acc + curr.quantity,
              0,
            );
            commission = Number(promoter.commissionValue) * ticketCount;
          } else if (
            promoter.commissionType === 'PERCENTAGE' &&
            promoter.commissionValue
          ) {
            commission =
              Number(order.ticketAmount) *
              (Number(promoter.commissionValue) / 100);
          }

          if (commission > 0) {
            await tx.eventStaff.update({
              where: { id: promoter.id },
              data: { totalEarned: { increment: commission } },
            });
          }
        }
      }

      return true;
    });
  }

  // Reverses the order paid by a payment that Mercado Pago refunded, charged
  // back or cancelled: the order is cancelled, its tickets are voided and they
  // go back on sale. Conditional on PAID so it applies only once. Returns the
  // order id, or null if there was nothing to reverse.
  async refundPaymentTransaction(providerPaymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { providerPaymentId, status: 'APPROVED' },
        select: { id: true, orderId: true },
      });
      if (!payment) return null;

      const { count } = await tx.order.updateMany({
        where: { id: payment.orderId, status: 'PAID' },
        data: { status: 'CANCELLED' },
      });
      if (count === 0) return null;

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });
      await tx.ticket.updateMany({
        where: { orderId: payment.orderId },
        data: { status: 'REFUNDED' },
      });
      const items = await tx.orderItem.findMany({
        where: { orderId: payment.orderId },
      });
      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { sold: { decrement: item.quantity } },
        });
      }
      return payment.orderId;
    });
  }
}
