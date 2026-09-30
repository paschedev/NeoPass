import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, Order } from '@prisma/client';
import { hasUsableMercadoPagoToken } from '../../payments/mercadopago-token';
import { getSaleWindowStatus } from '../../events/batch-sale-status';

type EventWithOrganizer = Prisma.EventGetPayload<{
  include: { organizer: true };
}>;

@Injectable()
export class OrdersRepository {
  constructor(private prisma: PrismaService) {}

  async createCheckoutOrderTransaction(
    userId: string,
    items: { ticketTypeId: string; quantity: number }[],
    promoterId?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      let ticketAmount = new Prisma.Decimal(0);
      const mpItems = [];
      const orderItemsData = [];
      let orderEvent: EventWithOrganizer | undefined;

      for (const item of items) {
        const ticketType = await tx.ticketType.findUnique({
          where: { id: item.ticketTypeId },
          include: {
            event: { include: { organizer: true } },
            batch: true,
          },
        });

        if (!ticketType)
          throw new BadRequestException(
            `TicketType ${item.ticketTypeId} not found`,
          );

        const event = ticketType.event;
        // One order = one event: the fee and the organizer who gets paid come from it.
        if (orderEvent && orderEvent.id !== event.id) {
          throw new BadRequestException(
            'Una orden solo puede tener entradas de un evento.',
          );
        }
        orderEvent = event;
        const now = new Date();

        // Security / Lifecycle Checks
        if (event.status !== 'PUBLISHED') {
          throw new BadRequestException(`El evento no se encuentra activo.`);
        }
        if (event.endDate < now) {
          throw new BadRequestException(`El evento ya ha finalizado.`);
        }
        if (
          !ticketType.batch ||
          getSaleWindowStatus(ticketType.batch, event.endDate, now) !== 'OPEN'
        ) {
          throw new BadRequestException(
            `La tanda de venta para este ticket no está activa en este momento.`,
          );
        }

        // Calculate available stock
        const availableStock =
          ticketType.stock - ticketType.sold - ticketType.reserved;

        if (availableStock < item.quantity) {
          throw new BadRequestException(
            `Not enough stock for ${ticketType.name}`,
          );
        }

        // Increment reserved stock
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { increment: item.quantity } },
        });

        ticketAmount = ticketAmount.add(ticketType.price.mul(item.quantity));

        mpItems.push({
          id: ticketType.id,
          title: `${ticketType.event.title} - ${ticketType.name}`,
          quantity: item.quantity,
          unit_price: ticketType.price.toNumber(),
          currency_id: 'ARS',
        });

        orderItemsData.push({
          ticketTypeId: ticketType.id,
          quantity: item.quantity,
          unitPrice: ticketType.price,
        });
      }

      // items is never empty (DTO), so the event is always set here.
      const event = orderEvent!;
      // The organizer collects with their own Mercado Pago account; the
      // platform account never collects a sale, nor an expired token.
      const { organizer } = event;
      if (!hasUsableMercadoPagoToken(organizer, new Date())) {
        throw new ConflictException(
          'El organizador de este evento todavía no puede cobrar entradas.',
        );
      }
      const sellerToken = organizer.mercadoPagoAccessToken;
      const serviceFee = ticketAmount
        .mul(event.neoPassFeePercentage)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
      mpItems.push({
        id: 'service_fee',
        title: 'Cargo por servicio',
        quantity: 1,
        unit_price: serviceFee.toNumber(),
        currency_id: 'ARS',
      });
      const totalAmount = ticketAmount.add(serviceFee);

      // Only an accepted promoter of this event earns a commission; any other
      // id is dropped so a stale or foreign referral link doesn't block the sale.
      const promoter = promoterId
        ? await tx.eventStaff.findFirst({
            where: {
              id: promoterId,
              eventId: event.id,
              role: 'PROMOTER',
              status: 'ACCEPTED',
            },
            select: { id: true },
          })
        : null;

      // Create Order in PENDING status
      const order = await tx.order.create({
        data: {
          userId,
          status: 'PENDING',
          totalAmount,
          ticketAmount,
          serviceFee,
          promoterId: promoter?.id,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes to pay
          orderItems: {
            create: orderItemsData,
          },
        },
        include: {
          orderItems: {
            include: {
              ticketType: {
                include: { event: { include: { organizer: true } } },
              },
            },
          },
        },
      });

      return { order, mpItems, serviceFee, sellerToken };
    });
  }

  async markOrderFailedAndRollbackStock(orderId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Conditional on PENDING so the reservation is released exactly once.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (count === 0) return;

      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        await tx.ticketType.update({
          where: { id: item.ticketTypeId },
          data: { reserved: { decrement: item.quantity } },
        });
      }
    });
  }
}
