import { Job } from 'bullmq';
import request from 'supertest';
import {
  CommissionType,
  StaffRole,
  StaffStatus,
  TicketType,
  User,
} from '@prisma/client';
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

type PromoterEventStats = {
  totalEarned: number;
  recentSales: { commission: number }[];
};

describe('RPP', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function addStaff(
    eventId: string,
    {
      role = 'PROMOTER',
      status = 'ACCEPTED',
      commissionType = 'PERCENTAGE',
      commissionValue = 10,
      user,
    }: {
      role?: StaffRole;
      status?: StaffStatus;
      commissionType?: CommissionType;
      commissionValue?: number;
      user?: User;
    } = {},
  ) {
    const staffUser = user ?? (await createUser(t.prisma));
    const staff = await t.prisma.eventStaff.create({
      data: {
        eventId,
        userId: staffUser.id,
        role,
        status,
        ...(role === 'PROMOTER' && { commissionType, commissionValue }),
      },
    });
    return { staff, user: staffUser };
  }

  function visit(eventId: string, rpp: string, ip = '203.0.113.10') {
    return request(t.app.getHttpServer())
      .get(`/events/${eventId}?rpp=${rpp}`)
      .set('X-Forwarded-For', ip);
  }

  async function clicks(staffId: string) {
    const staff = await t.prisma.eventStaff.findUniqueOrThrow({
      where: { id: staffId },
    });
    return staff.clicks;
  }

  // Notificación de MP: el pago se lee con el estado que tiene ahora.
  function notify(orderId: string, amount: number, status = 'approved') {
    mercadoPagoMock.paymentGet.mockResolvedValueOnce({
      status,
      external_reference: orderId,
      transaction_amount: amount,
    });
    const processor = new PaymentsProcessor(t.app.get(PaymentsService));
    return processor.process({
      name: 'process-payment',
      data: { paymentId: `pago-${orderId}` },
    } as Job);
  }

  async function paidSale(
    ticketType: TicketType,
    promoterId: string,
    quantity = 1,
  ) {
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      quantity,
      promoterId,
    });
    await notify(order.id, Number(order.totalAmount));
    return order;
  }

  function eventStats(promoter: User, eventId: string) {
    return request(t.app.getHttpServer())
      .get(`/events/promoter/me/${eventId}/stats`)
      .set('Authorization', authHeader(t.app, promoter));
  }

  async function totalEarned(staffId: string) {
    const staff = await t.prisma.eventStaff.findUniqueOrThrow({
      where: { id: staffId },
    });
    return staff.totalEarned.toFixed(2);
  }

  describe('clicks del link', () => {
    it('una visita desde el link de un RPP aceptado del evento suma un click', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id);

      await visit(event.id, staff.id).expect(200);

      expect(await clicks(staff.id)).toBe(1);
    });

    it('el mismo visitante que recarga dentro de la hora no suma otro click', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id);

      await visit(event.id, staff.id).expect(200);
      await visit(event.id, staff.id).expect(200);

      expect(await clicks(staff.id)).toBe(1);
    });

    it('cada visitante distinto suma su click', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id);

      await visit(event.id, staff.id, '203.0.113.10').expect(200);
      await visit(event.id, staff.id, '203.0.113.11').expect(200);

      expect(await clicks(staff.id)).toBe(2);
    });

    it.each([
      ['una invitación pendiente', { status: 'PENDING' }],
      ['una invitación rechazada', { status: 'REJECTED' }],
      ['un scanner', { role: 'SCANNER' }],
    ] as const)('el link de %s no suma clicks', async (_case, staffData) => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id, staffData);

      await visit(event.id, staff.id).expect(200);

      expect(await clicks(staff.id)).toBe(0);
    });

    it('el link de un RPP de otro evento no suma clicks', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const other = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(other.event.id);

      await visit(event.id, staff.id).expect(200);

      expect(await clicks(staff.id)).toBe(0);
    });

    it('un evento que no es público no suma clicks', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'DRAFT' },
      });

      await visit(event.id, staff.id).expect(404);

      expect(await clicks(staff.id)).toBe(0);
    });

    it('un link de RPP inválido no rompe la página del evento', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      await visit(event.id, 'no-es-un-rpp').expect(200);
    });
  });

  describe('panel del RPP', () => {
    it('lista solo los eventos en los que aceptó la invitación', async () => {
      const promoter = await createUser(t.prisma);
      const accepted = await createOrganizerWithEvent(t.prisma);
      const pending = await createOrganizerWithEvent(t.prisma);
      const rejected = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(accepted.event.id, { user: promoter });
      await addStaff(pending.event.id, { user: promoter, status: 'PENDING' });
      await addStaff(rejected.event.id, { user: promoter, status: 'REJECTED' });

      const res = await request(t.app.getHttpServer())
        .get('/events/promoter/me')
        .set('Authorization', authHeader(t.app, promoter))
        .expect(200);

      const body = res.body as { events: { id: string }[] };
      expect(body.events.map((e) => e.id)).toEqual([staff.id]);
    });

    it.each(['PENDING', 'REJECTED'] as const)(
      'las estadísticas de un evento con la invitación %s dan 404',
      async (status) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        const { user } = await addStaff(event.id, { status });

        await eventStats(user, event.id).expect(404);
      },
    );
  });

  describe('comisión por venta', () => {
    it('una comisión porcentual se calcula sobre el valor de las entradas', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      const { staff, user } = await addStaff(event.id, {
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
      });

      await paidSale(ticketType, staff.id, 2);

      const res = await eventStats(user, event.id).expect(200);
      const stats = res.body as PromoterEventStats;
      expect(stats.recentSales.map((s) => s.commission)).toEqual([200]);
      expect(await totalEarned(staff.id)).toBe('200.00');
    });

    it('una comisión fija se paga por cada entrada', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
      const { staff } = await addStaff(event.id, {
        commissionType: 'FIXED',
        commissionValue: 500,
      });

      await paidSale(ticketType, staff.id, 2);

      expect(await totalEarned(staff.id)).toBe('1000.00');
    });

    it('la comisión se redondea a centavos', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 333.33,
      });
      const { staff, user } = await addStaff(event.id, {
        commissionType: 'PERCENTAGE',
        commissionValue: 7.5,
      });

      await paidSale(ticketType, staff.id);

      const res = await eventStats(user, event.id).expect(200);
      const stats = res.body as PromoterEventStats;
      expect(stats.recentSales.map((s) => s.commission)).toEqual([25]);
      expect(stats.totalEarned).toBe(25);
    });

    it('cambiar la comisión después no cambia las ventas ya hechas', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      const { staff, user } = await addStaff(event.id, {
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
      });
      await paidSale(ticketType, staff.id);

      await t.prisma.eventStaff.update({
        where: { id: staff.id },
        data: { commissionValue: 50 },
      });

      const res = await eventStats(user, event.id).expect(200);
      const stats = res.body as PromoterEventStats;
      expect(stats.recentSales.map((s) => s.commission)).toEqual([100]);
      expect(stats.totalEarned).toBe(100);
    });

    it('una devolución le resta al RPP la comisión de esa venta', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      const { staff } = await addStaff(event.id, {
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
      });
      await paidSale(ticketType, staff.id);
      const refunded = await paidSale(ticketType, staff.id);

      await notify(refunded.id, Number(refunded.totalAmount), 'refunded');

      expect(await totalEarned(staff.id)).toBe('100.00');
    });
  });
});
