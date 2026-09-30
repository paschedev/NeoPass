import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import type { MercadoPagoCredentials } from '../mercadopago-token';
import {
  ENCRYPTED_TOKEN_PREFIX,
  MercadoPagoTokenCipher,
} from '../mercadopago-token-cipher';
import { calculatePromoterCommission } from '../promoter-commission';

// The organizers' Mercado Pago tokens are encrypted here, at the database
// boundary: every method takes and returns them readable.
@Injectable()
export class PaymentsRepository {
  constructor(
    private prisma: PrismaService,
    private cipher: MercadoPagoTokenCipher,
  ) {}

  async updateUserMercadoPagoCredentials(
    userId: string,
    credentials: MercadoPagoCredentials,
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: this.encrypted(credentials),
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
        ? [{ id, refreshToken: this.cipher.decrypt(mercadoPagoRefreshToken) }]
        : [],
    );
  }

  // Only if the refresh token is still the one that was used: a concurrent
  // renewal (or a new link) already stored newer credentials. The update is
  // conditional on the stored value, which is encrypted.
  async replaceMercadoPagoCredentials(
    userId: string,
    usedRefreshToken: string,
    credentials: MercadoPagoCredentials,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mercadoPagoRefreshToken: true },
    });
    const stored = user?.mercadoPagoRefreshToken;
    if (!stored || this.cipher.decrypt(stored) !== usedRefreshToken) {
      return false;
    }
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, mercadoPagoRefreshToken: stored },
      data: this.encrypted(credentials),
    });
    return count > 0;
  }

  async findMercadoPagoTokenByUserId(mercadoPagoUserId: string) {
    const user = await this.prisma.user.findFirst({
      where: { mercadoPagoUserId },
      select: { mercadoPagoAccessToken: true },
    });
    return user?.mercadoPagoAccessToken
      ? this.cipher.decrypt(user.mercadoPagoAccessToken)
      : null;
  }

  // Tokens stored before they were encrypted. Each update is conditional on
  // the values that were read, so a link or renewal in between is kept.
  // Returns how many organizers were updated.
  async encryptPlaintextMercadoPagoTokens() {
    const organizers = await this.prisma.user.findMany({
      where: {
        OR: [
          {
            mercadoPagoAccessToken: { not: null },
            NOT: {
              mercadoPagoAccessToken: { startsWith: ENCRYPTED_TOKEN_PREFIX },
            },
          },
          {
            mercadoPagoRefreshToken: { not: null },
            NOT: {
              mercadoPagoRefreshToken: { startsWith: ENCRYPTED_TOKEN_PREFIX },
            },
          },
        ],
      },
      select: {
        id: true,
        mercadoPagoAccessToken: true,
        mercadoPagoRefreshToken: true,
      },
    });
    let updated = 0;
    for (const {
      id,
      mercadoPagoAccessToken,
      mercadoPagoRefreshToken,
    } of organizers) {
      const { count } = await this.prisma.user.updateMany({
        where: { id, mercadoPagoAccessToken, mercadoPagoRefreshToken },
        data: {
          mercadoPagoAccessToken: this.encryptIfPlaintext(
            mercadoPagoAccessToken,
          ),
          mercadoPagoRefreshToken: this.encryptIfPlaintext(
            mercadoPagoRefreshToken,
          ),
        },
      });
      updated += count;
    }
    return updated;
  }

  private encrypted(credentials: MercadoPagoCredentials) {
    return {
      ...credentials,
      mercadoPagoAccessToken: this.cipher.encrypt(
        credentials.mercadoPagoAccessToken,
      ),
      mercadoPagoRefreshToken:
        credentials.mercadoPagoRefreshToken === null
          ? null
          : this.cipher.encrypt(credentials.mercadoPagoRefreshToken),
    };
  }

  private encryptIfPlaintext(token: string | null) {
    if (token === null || this.cipher.isEncrypted(token)) return token;
    return this.cipher.encrypt(token);
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

      // The promoter's commission is fixed on the order when it is paid, so a
      // refund takes back exactly that amount.
      if (order.promoterId) {
        const promoter = await tx.eventStaff.findUniqueOrThrow({
          where: { id: order.promoterId },
        });
        const commission = calculatePromoterCommission(promoter, {
          ticketAmount: order.ticketAmount,
          ticketCount: order.orderItems.reduce(
            (acc, curr) => acc + curr.quantity,
            0,
          ),
        });
        await tx.order.update({
          where: { id: order.id },
          data: { promoterCommission: commission },
        });
        await tx.eventStaff.update({
          where: { id: promoter.id },
          data: { totalEarned: { increment: commission } },
        });
      }

      return true;
    });
  }

  // Reverses the order paid by a payment that Mercado Pago refunded, charged
  // back or cancelled: the order is cancelled, its tickets are voided, they go
  // back on sale and the promoter loses the commission of that order.
  // Conditional on PAID so it applies only once. Returns the
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
      const { promoterId, promoterCommission } =
        await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
          select: { promoterId: true, promoterCommission: true },
        });
      if (promoterId && promoterCommission) {
        await tx.eventStaff.update({
          where: { id: promoterId },
          data: { totalEarned: { decrement: promoterCommission } },
        });
      }
      return payment.orderId;
    });
  }
}
