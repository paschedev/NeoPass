import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OrderStatus, Prisma } from '@prisma/client';
import type { MercadoPagoCredentials } from '../mercadopago-token';
import {
  ENCRYPTED_TOKEN_PREFIX,
  MercadoPagoTokenCipher,
} from '../mercadopago-token-cipher';

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

  // Whether this Mercado Pago payment already paid an order, on its own or as
  // a part of a combined payment.
  async isPaymentRegistered(providerPaymentId: string) {
    const payments = await this.prisma.payment.count({
      where: paidBy(providerPaymentId),
    });
    return payments > 0;
  }

  // Records an approved part of a combined payment and returns the approved
  // parts of its order. The order row stays locked until the end, so two
  // parts that arrive at once can't miss each other: the second one sees the
  // first. Recording the same part again changes nothing.
  async recordPaymentPart(
    orderId: string,
    part: {
      providerPaymentId: string;
      amount: number;
      mercadoPagoFee: Prisma.Decimal | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      await tx.paymentPart.createMany({
        data: [{ orderId, ...part }],
        skipDuplicates: true,
      });
      return tx.paymentPart.findMany({
        where: { orderId, status: 'APPROVED' },
        select: APPROVED_PART_FIELDS,
        orderBy: { createdAt: 'asc' },
      });
    });
  }

  async findApprovedPaymentParts(orderId: string) {
    return this.prisma.paymentPart.findMany({
      where: { orderId, status: 'APPROVED' },
      select: APPROVED_PART_FIELDS,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOrderForPayment(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        ticketAmount: true,
        serviceFee: true,
        marketplaceFee: true,
        feeAdjustment: true,
        payment: { select: { id: true } },
        promoter: {
          select: { id: true, commissionType: true, commissionValue: true },
        },
        orderItems: {
          select: {
            quantity: true,
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
  // The promoter's commission is fixed on the order when it is paid, so a
  // refund takes back exactly that amount. The organizer's Mercado Pago terms
  // are updated only if this payment is newer than the one they came from.
  // Their balance with NeoPass takes the sale's deviation and drops what the
  // sale collected, never below zero.
  async payOrderTransaction(
    {
      orderId,
      fromStatus,
      payment,
      promoterCommission,
      organizerTerms,
      feeDeviation,
    }: {
      orderId: string;
      fromStatus: OrderStatus;
      // A combined payment has no single Mercado Pago id: its order's
      // PaymentParts hold them.
      payment: {
        providerPaymentId: string | null;
        amount: number | Prisma.Decimal;
        mercadoPagoFee: Prisma.Decimal | null;
      };
      promoterCommission: { promoterId: string; amount: Prisma.Decimal } | null;
      organizerTerms: {
        organizerId: string;
        feeRate: Prisma.Decimal;
        releaseDays: number | null;
        approvedAt: Date;
      } | null;
      feeDeviation: Prisma.Decimal | null;
    },
    generateTicketsCallback: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: fromStatus },
        data: {
          status: 'PAID',
          promoterCommission: promoterCommission?.amount,
          mercadoPagoFee: payment.mercadoPagoFee,
          feeDeviation,
        },
      });
      if (count === 0) return false;

      await moveFeeBalance(tx, orderId, 'pay');

      if (organizerTerms) {
        const { organizerId, feeRate, releaseDays, approvedAt } =
          organizerTerms;
        await tx.user.updateMany({
          where: {
            id: organizerId,
            OR: [
              { mercadoPagoFeeRateAt: null },
              { mercadoPagoFeeRateAt: { lt: approvedAt } },
            ],
          },
          data: {
            mercadoPagoFeeRate: feeRate,
            mercadoPagoReleaseDays: releaseDays,
            mercadoPagoFeeRateAt: approvedAt,
          },
        });
      }

      const items = await tx.orderItem.findMany({ where: { orderId } });
      const hadReservation = fromStatus === 'PENDING';
      for (const item of items) {
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
          orderId,
          provider: 'MERCADO_PAGO',
          providerPaymentId: payment.providerPaymentId,
          status: 'APPROVED',
          amount: payment.amount,
        },
      });

      // Execute callback to generate tickets
      await generateTicketsCallback(tx);

      if (promoterCommission) {
        await tx.eventStaff.update({
          where: { id: promoterCommission.promoterId },
          data: { totalEarned: { increment: promoterCommission.amount } },
        });
      }

      return true;
    });
  }

  // Reverses the order paid by a payment that Mercado Pago refunded, charged
  // back or cancelled: the order is cancelled, its tickets are voided, they go
  // back on sale and the promoter loses the commission of that order.
  // A part of a combined payment stops counting towards its order, and if
  // the order was already paid with it, the order is reversed the same way.
  // Conditional on PAID so it applies only once. Returns the
  // order id, or null if there was nothing to reverse.
  async refundPaymentTransaction(providerPaymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.paymentPart.updateMany({
        where: { providerPaymentId, status: 'APPROVED' },
        data: { status: 'REFUNDED' },
      });
      const payment = await tx.payment.findFirst({
        where: { ...paidBy(providerPaymentId), status: 'APPROVED' },
        select: { id: true, orderId: true },
      });
      if (!payment) return null;

      const { count } = await tx.order.updateMany({
        where: { id: payment.orderId, status: 'PAID' },
        data: { status: 'CANCELLED' },
      });
      if (count === 0) return null;

      await moveFeeBalance(tx, payment.orderId, 'refund');
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

// The organizer's balance with NeoPass after one of their sales is paid
// (adds its deviation, drops what it collected) or refunded (undoes both,
// assuming Mercado Pago returns the marketplace_fee: VER-08). Never below
// zero: a deviation in the organizer's favor lowers a debt, it never leaves
// them credit. It runs before any ticket type is touched, so it locks the
// organizer's row in the same order as a checkout.
function moveFeeBalance(
  tx: Prisma.TransactionClient,
  orderId: string,
  change: 'pay' | 'refund',
) {
  const sign = change === 'pay' ? 1 : -1;
  return tx.$executeRaw`
    UPDATE "User" u
    SET "mercadoPagoFeeBalance" = GREATEST(0, u."mercadoPagoFeeBalance"
      + ${sign} * (COALESCE(o."feeDeviation", 0) - o."feeAdjustment"))
    FROM "Order" o
    JOIN "OrderItem" oi ON oi."orderId" = o.id
    JOIN "TicketType" tt ON tt.id = oi."ticketTypeId"
    JOIN "Event" e ON e.id = tt."eventId"
    WHERE o.id = ${orderId} AND u.id = e."organizerId"`;
}

const APPROVED_PART_FIELDS = {
  providerPaymentId: true,
  amount: true,
  mercadoPagoFee: true,
} satisfies Prisma.PaymentPartSelect;

// The order's payment made with this Mercado Pago payment: it is the payment
// itself, or one of the parts of the combined payment.
function paidBy(providerPaymentId: string): Prisma.PaymentWhereInput {
  return {
    OR: [
      { providerPaymentId },
      { order: { paymentParts: { some: { providerPaymentId } } } },
    ],
  };
}
