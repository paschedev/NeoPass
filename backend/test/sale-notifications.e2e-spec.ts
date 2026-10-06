import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventPermission, StaffStatus, User } from '@prisma/client';
import request from 'supertest';
import { PaymentsProcessor } from '../src/payments/payments.processor';
import { PaymentsService } from '../src/payments/payments.service';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const PRICE = 1000;

describe('Avisos de venta', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function setup() {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
      { price: PRICE },
    );
    const buyer = await createUser(t.prisma);
    return { organizer, event, ticketType, buyer };
  }

  // Notificación de MP de un pago aprobado por el total de la orden.
  async function pay(paymentId: string, orderId: string) {
    const order = await t.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: orderId,
      transaction_amount: order.totalAmount.toNumber(),
    });
    const processor = new PaymentsProcessor(t.app.get(PaymentsService));
    return processor.process({
      name: 'process-payment',
      data: { paymentId },
    } as Job);
  }

  async function sell(
    s: Awaited<ReturnType<typeof setup>>,
    quantity: number,
    promoterId?: string,
  ) {
    const order = await createOrder(t.prisma, {
      user: s.buyer,
      ticketType: s.ticketType,
      quantity,
      promoterId,
    });
    await pay(`pago-${order.id}`, order.id);
    return order;
  }

  function notices(user: Pick<User, 'id'>) {
    return t.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  function addStaff(
    eventId: string,
    data: {
      role: 'MANAGER' | 'SCANNER' | 'PROMOTER';
      status?: StaffStatus;
      permissions?: EventPermission[];
    },
  ) {
    return createUser(t.prisma).then(async (user) => ({
      user,
      staff: await t.prisma.eventStaff.create({
        data: {
          eventId,
          userId: user.id,
          role: data.role,
          status: data.status ?? 'ACCEPTED',
          permissions: data.permissions ?? [],
          ...(data.role === 'PROMOTER' && {
            commissionType: 'PERCENTAGE',
            commissionValue: 10,
          }),
        },
      }),
    }));
  }

  describe('al organizador', () => {
    it('al confirmarse un pago recibe las entradas vendidas y lo cobrado, con link al detalle', async () => {
      const s = await setup();

      await sell(s, 2);

      expect(await notices(s.organizer)).toEqual([
        expect.objectContaining({
          type: 'EVENT_SALES',
          title: `Ventas de ${s.event.title}`,
          message: 'Se vendieron 2 entradas nuevas: $2.000.',
          eventId: s.event.id,
          actionUrl: `/panel/eventos/${s.event.id}`,
          isRead: false,
        }),
      ]);
    });

    it('si el aviso sigue sin leer, la venta siguiente suma en el mismo aviso y lo sube al primer lugar', async () => {
      const s = await setup();
      await sell(s, 2);
      await t.prisma.notification.create({
        data: {
          userId: s.organizer.id,
          type: 'SYSTEM',
          title: 'Otro aviso',
          message: 'Llegó después de la primera venta.',
        },
      });

      await sell(s, 1);

      const sales = (await notices(s.organizer)).filter(
        (n) => n.type === 'EVENT_SALES',
      );
      expect(sales).toHaveLength(1);
      expect(sales[0].message).toBe('Se vendieron 3 entradas nuevas: $3.000.');
      const feed = await request(t.app.getHttpServer())
        .get('/notifications/feed')
        .set('Authorization', authHeader(t.app, s.organizer))
        .expect(200);
      expect((feed.body as { items: { id: string }[] }).items[0].id).toBe(
        sales[0].id,
      );
    });

    it('si ya lo leyó, la venta siguiente abre un aviso nuevo', async () => {
      const s = await setup();
      await sell(s, 2);
      await request(t.app.getHttpServer())
        .put('/notifications/read-all')
        .set('Authorization', authHeader(t.app, s.organizer))
        .expect(200);

      await sell(s, 1);

      expect(
        (await notices(s.organizer)).map((n) => [n.message, n.isRead]),
      ).toEqual([
        ['Se vendieron 2 entradas nuevas: $2.000.', true],
        ['Se vendió 1 entrada nueva: $1.000.', false],
      ]);
    });

    it('el mismo pago notificado dos veces no suma dos veces', async () => {
      const s = await setup();
      const order = await createOrder(t.prisma, {
        user: s.buyer,
        ticketType: s.ticketType,
        quantity: 2,
      });

      await pay('pago-1', order.id);
      await pay('pago-1', order.id);

      expect((await notices(s.organizer)).map((n) => n.message)).toEqual([
        'Se vendieron 2 entradas nuevas: $2.000.',
      ]);
      expect(await notices(s.buyer)).toHaveLength(1);
    });

    it('dos pagos a la vez del mismo evento quedan en un solo aviso con la suma', async () => {
      const s = await setup();
      const first = await createOrder(t.prisma, {
        user: s.buyer,
        ticketType: s.ticketType,
        quantity: 2,
      });
      const second = await createOrder(t.prisma, {
        user: s.buyer,
        ticketType: s.ticketType,
        quantity: 3,
      });

      await Promise.all([pay('pago-1', first.id), pay('pago-2', second.id)]);

      expect((await notices(s.organizer)).map((n) => n.message)).toEqual([
        'Se vendieron 5 entradas nuevas: $5.000.',
      ]);
    });
  });

  it('los co-organizadores aceptados con "Ver ventas" también lo reciben; sin ese permiso o con la invitación pendiente, no', async () => {
    const s = await setup();
    const sees = await addStaff(s.event.id, {
      role: 'MANAGER',
      permissions: ['VIEW_SALES'],
    });
    const edits = await addStaff(s.event.id, {
      role: 'MANAGER',
      permissions: ['EDIT_EVENT'],
    });
    const pending = await addStaff(s.event.id, {
      role: 'MANAGER',
      status: 'PENDING',
      permissions: ['VIEW_SALES'],
    });
    const scanner = await addStaff(s.event.id, { role: 'SCANNER' });

    await sell(s, 2);

    expect(await notices(sees.user)).toEqual([
      expect.objectContaining({
        type: 'EVENT_SALES',
        message: 'Se vendieron 2 entradas nuevas: $2.000.',
      }),
    ]);
    for (const other of [edits, pending, scanner]) {
      expect(await notices(other.user)).toEqual([]);
    }
  });

  describe('al RPP', () => {
    it('la venta con su link le avisa cuántas vendió y cuánto ganó, y se acumula igual', async () => {
      const s = await setup();
      const rpp = await addStaff(s.event.id, { role: 'PROMOTER' });

      await sell(s, 2, rpp.staff.id);

      expect(await notices(rpp.user)).toEqual([
        expect.objectContaining({
          type: 'PROMOTER_SALE',
          title: `Tus ventas en ${s.event.title}`,
          message: 'Vendiste 2 entradas con tu link: ganaste $200.',
          actionUrl: `/panel/rpp/${s.event.id}`,
        }),
      ]);

      await sell(s, 1, rpp.staff.id);

      expect((await notices(rpp.user)).map((n) => n.message)).toEqual([
        'Vendiste 3 entradas con tu link: ganaste $300.',
      ]);
    });

    it('una venta sin su link no le avisa nada', async () => {
      const s = await setup();
      const rpp = await addStaff(s.event.id, { role: 'PROMOTER' });

      await sell(s, 2);

      expect(await notices(rpp.user)).toEqual([]);
    });
  });

  describe('a quien compra', () => {
    it('recibe "Compra confirmada" con link a Mis entradas', async () => {
      const s = await setup();

      await sell(s, 2);

      expect(await notices(s.buyer)).toEqual([
        expect.objectContaining({
          type: 'TICKET_PURCHASE',
          title: 'Compra confirmada',
          message: `Tus 2 entradas para ${s.event.title} ya están en Mis entradas.`,
          eventId: s.event.id,
          actionUrl: '/panel/tickets',
        }),
      ]);
    });

    it('cada compra tiene su propio aviso y una sola entrada va en singular', async () => {
      const s = await setup();

      await sell(s, 2);
      await sell(s, 1);

      expect((await notices(s.buyer)).map((n) => n.message)).toEqual([
        `Tus 2 entradas para ${s.event.title} ya están en Mis entradas.`,
        `Tu entrada para ${s.event.title} ya está en Mis entradas.`,
      ]);
    });
  });

  it('un pago por otro monto no genera avisos de venta', async () => {
    const s = await setup();
    const order = await createOrder(t.prisma, {
      user: s.buyer,
      ticketType: s.ticketType,
    });
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status: 'approved',
      external_reference: order.id,
      transaction_amount: 1,
    });

    await new PaymentsProcessor(t.app.get(PaymentsService)).process({
      name: 'process-payment',
      data: { paymentId: 'pago-1' },
    } as Job);

    expect((await notices(s.organizer)).map((n) => n.type)).toEqual(['SYSTEM']);
    expect(await notices(s.buyer)).toEqual([]);
  });

  it('si no se pueden guardar los avisos, la venta queda pagada igual y se registra el error', async () => {
    const s = await setup();
    const order = await createOrder(t.prisma, {
      user: s.buyer,
      ticketType: s.ticketType,
      quantity: 2,
    });
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    await t.prisma.$executeRawUnsafe(
      'ALTER TABLE "Notification" ADD CONSTRAINT "no_notices" CHECK (false) NOT VALID',
    );
    try {
      await pay('pago-1', order.id);
      expect(logged).toHaveBeenCalledWith(
        `Could not notify the sale of order ${order.id}`,
        expect.anything(),
      );
    } finally {
      await t.prisma.$executeRawUnsafe(
        'ALTER TABLE "Notification" DROP CONSTRAINT "no_notices"',
      );
      logged.mockRestore();
    }

    const paid = await t.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(paid.status).toBe('PAID');
    expect(await t.prisma.ticket.count({ where: { orderId: order.id } })).toBe(
      2,
    );
    expect(await t.prisma.notification.count()).toBe(0);
  });
});
