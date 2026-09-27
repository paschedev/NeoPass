import { randomUUID } from 'node:crypto';
import {
  Order,
  OrderStatus,
  Prisma,
  PrismaClient,
  TicketType,
  User,
} from '@prisma/client';

const HOUR_MS = 60 * 60 * 1000;
const ORDER_TTL_MS = 10 * 60 * 1000;

export function createUser(
  prisma: PrismaClient,
  data: Partial<Prisma.UserCreateInput> = {},
) {
  return prisma.user.create({
    data: {
      email: `user-${randomUUID()}@neopass.test`,
      name: 'Usuario de prueba',
      passwordHash: 'not-a-real-hash',
      ...data,
    },
  });
}

// Organizador con Mercado Pago vinculado y un evento publicado con una tanda en venta.
export async function createOrganizerWithEvent(
  prisma: PrismaClient,
  { price = 1000, stock = 100 }: { price?: number; stock?: number } = {},
) {
  const now = Date.now();
  const organizer = await createUser(prisma, {
    role: 'ORGANIZER',
    mercadoPagoAccessToken: 'TEST-organizer-access-token',
  });
  const event = await prisma.event.create({
    data: {
      title: 'Evento de prueba',
      description: 'Descripción del evento de prueba',
      startDate: new Date(now + 7 * 24 * HOUR_MS),
      endDate: new Date(now + 7 * 24 * HOUR_MS + 6 * HOUR_MS),
      status: 'PUBLISHED',
      organizerId: organizer.id,
    },
  });
  const batch = await prisma.ticketBatch.create({
    data: { eventId: event.id, name: 'Preventa', status: 'PUBLISHED' },
  });
  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: event.id,
      batchId: batch.id,
      name: 'General',
      price,
      stock,
      saleStart: new Date(now - HOUR_MS),
      saleEnd: new Date(now + 24 * HOUR_MS),
    },
  });
  return { organizer, event, batch, ticketType };
}

// Orden de un solo tipo de entrada que mueve el stock como el flujo real:
// PENDING reserva, PAID vende, y EXPIRED o CANCELLED no ocupan stock.
export function createOrder(
  prisma: PrismaClient,
  {
    user,
    ticketType,
    quantity = 1,
    status = 'PENDING',
  }: {
    user: Pick<User, 'id'>;
    ticketType: Pick<TicketType, 'id' | 'price'>;
    quantity?: number;
    status?: OrderStatus;
  },
) {
  const ticketAmount = new Prisma.Decimal(ticketType.price).mul(quantity);

  return prisma.$transaction(async (tx) => {
    if (status === 'PENDING') {
      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { reserved: { increment: quantity } },
      });
    } else if (status === 'PAID') {
      await tx.ticketType.update({
        where: { id: ticketType.id },
        data: { sold: { increment: quantity } },
      });
    }

    return tx.order.create({
      data: {
        userId: user.id,
        status,
        ticketAmount,
        totalAmount: ticketAmount,
        expiresAt: new Date(Date.now() + ORDER_TTL_MS),
        orderItems: {
          create: {
            ticketTypeId: ticketType.id,
            quantity,
            unitPrice: ticketType.price,
          },
        },
      },
    });
  });
}

// Ticket válido de una orden; por defecto el dueño es quien compró.
export function createTicket(
  prisma: PrismaClient,
  {
    order,
    ticketType,
    ownerId = order.userId,
  }: {
    order: Pick<Order, 'id' | 'userId'>;
    ticketType: Pick<TicketType, 'id'>;
    ownerId?: string;
  },
) {
  return prisma.ticket.create({
    data: { orderId: order.id, ticketTypeId: ticketType.id, userId: ownerId },
  });
}
