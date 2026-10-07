import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];
type MpItem = { id: string; unit_price: number };
type Preference = { items: MpItem[]; marketplace_fee?: number };
type AdminEvent = {
  id: string;
  title: string;
  status: string;
  neoPassFeePercentage: string;
  organizer: { name: string; email: string };
};
type AdminEventsPage = {
  items: AdminEvent[];
  total: number;
  page: number;
  limit: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

describe('Panel ADMIN: cargo de servicio por evento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mockTurnstile(true);
    mercadoPagoMock.preferenceCreate.mockResolvedValue({
      init_point: 'https://mercadopago.test/checkout',
    });
  });

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());
  const createAdmin = () =>
    createUser(t.prisma, { role: 'ADMIN', name: 'Cuenta ADMIN' });

  function listEvents(user: User | null, query = '') {
    const req = http().get(`/admin/events${query}`);
    return user ? req.set('Authorization', authHeader(t.app, user)) : req;
  }

  function changeFee(user: User | null, eventId: string, body: object) {
    const req = http().patch(`/admin/events/${eventId}/service-fee`);
    return (
      user ? req.set('Authorization', authHeader(t.app, user)) : req
    ).send(body);
  }

  function checkout(buyer: User, ticketTypeId: string) {
    return http()
      .post('/orders/checkout')
      .set('Authorization', authHeader(t.app, buyer))
      .send({
        captchaToken: 'captcha-de-prueba',
        items: [{ ticketTypeId, quantity: 1 }],
      });
  }

  function lastPreference(): Preference {
    const calls = mercadoPagoMock.preferenceCreate.mock.calls;
    return (calls[calls.length - 1] as [{ body: Preference }, string])[0].body;
  }

  async function feeOf(eventId: string) {
    const event = await t.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    return event.neoPassFeePercentage.toString();
  }

  describe('acceso', () => {
    it('sin sesión no se ve ni se cambia el cargo', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      await listEvents(null).expect(401);
      await changeFee(null, event.id, { percentage: 8 }).expect(401);
    });

    it('un comprador o un organizador no entra, aunque sea el dueño del evento: el cargo lo decide NeoPass', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const buyer = await createUser(t.prisma);

      for (const user of [organizer, buyer]) {
        await listEvents(user).expect(403);
        await changeFee(user, event.id, { percentage: 8 }).expect(403);
      }
      expect(await feeOf(event.id)).toBe('15');
    });
  });

  describe('listado', () => {
    it('muestra los eventos de todos los organizadores con su organizador, su estado y su cargo', async () => {
      const first = await createOrganizerWithEvent(t.prisma);
      const second = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: second.event.id },
        data: { title: 'Fiesta de primavera', neoPassFeePercentage: 8 },
      });

      const res = await listEvents(await createAdmin()).expect(200);

      const page = res.body as AdminEventsPage;
      expect(page).toMatchObject({ total: 2, page: 1, limit: 20 });
      expect(page.items.find((e) => e.id === second.event.id)).toEqual({
        id: second.event.id,
        title: 'Fiesta de primavera',
        status: 'PUBLISHED',
        startDate: second.event.startDate.toISOString(),
        endDate: second.event.endDate.toISOString(),
        deletedAt: null,
        neoPassFeePercentage: '8',
        organizer: {
          name: second.organizer.name,
          email: second.organizer.email,
        },
      });
      expect(
        page.items.find((e) => e.id === first.event.id)?.neoPassFeePercentage,
      ).toBe('15');
    });

    it('busca por nombre del evento o por email del organizador, sin importar mayúsculas', async () => {
      const admin = await createAdmin();
      const spring = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: spring.event.id },
        data: { title: 'Fiesta de primavera' },
      });
      const other = await createOrganizerWithEvent(t.prisma);

      const byTitle = await listEvents(admin, '?q=PRIMAVERA').expect(200);
      expect((byTitle.body as AdminEventsPage).items.map((e) => e.id)).toEqual([
        spring.event.id,
      ]);

      const byEmail = await listEvents(
        admin,
        `?q=${encodeURIComponent(other.organizer.email.toUpperCase())}`,
      ).expect(200);
      expect((byEmail.body as AdminEventsPage).items.map((e) => e.id)).toEqual([
        other.event.id,
      ]);
    });

    it('trae de a 20 eventos, los de fecha más lejana primero', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);
      const now = Date.now();
      await t.prisma.event.createMany({
        data: Array.from({ length: 21 }, (_, i) => ({
          title: `Evento ${i + 1}`,
          description: 'Descripción',
          status: 'PUBLISHED' as const,
          startDate: new Date(now + (30 + i) * DAY_MS),
          endDate: new Date(now + (30 + i) * DAY_MS + DAY_MS / 4),
          organizerId: organizer.id,
        })),
      });
      const admin = await createAdmin();

      const first = (await listEvents(admin).expect(200))
        .body as AdminEventsPage;
      const second = (await listEvents(admin, '?page=2').expect(200))
        .body as AdminEventsPage;

      expect(first.total).toBe(22);
      expect(first.items).toHaveLength(20);
      expect(first.items[0].title).toBe('Evento 21');
      expect(second.items).toHaveLength(2);
      expect(second.items[1].title).toBe('Evento de prueba');
    });

    it('no expone datos sensibles del organizador', async () => {
      await createOrganizerWithEvent(t.prisma);

      const res = await listEvents(await createAdmin()).expect(200);

      const organizer = (res.body as AdminEventsPage).items[0].organizer;
      expect(Object.keys(organizer).sort()).toEqual(['email', 'name']);
    });

    it('rechaza una búsqueda o una página inválidas', async () => {
      const admin = await createAdmin();

      await listEvents(admin, '?page=0').expect(400);
      await listEvents(admin, `?q=${'a'.repeat(101)}`).expect(400);
    });
  });

  describe('cambiar el cargo', () => {
    it('el nuevo cargo se ve en la página del evento y lo usa la próxima compra', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });

      const res = await changeFee(await createAdmin(), event.id, {
        percentage: 8.5,
      }).expect(200);
      expect(res.body).toEqual({ id: event.id, neoPassFeePercentage: '8.5' });

      const publicPage = await http().get(`/events/${event.id}`).expect(200);
      expect(
        (publicPage.body as { neoPassFeePercentage: string })
          .neoPassFeePercentage,
      ).toBe('8.5');

      const buyer = await createUser(t.prisma);
      const started = await checkout(buyer, ticketType.id).expect(201);
      const order = await t.prisma.order.findUniqueOrThrow({
        where: { id: (started.body as { orderId: string }).orderId },
      });
      expect(order.serviceFee.toFixed(2)).toBe('85.00');
      const preference = lastPreference();
      expect(
        preference.items.find((item) => item.id === 'service_fee')?.unit_price,
      ).toBe(85);
      expect(preference.marketplace_fee).toBe(85);
    });

    it('una compra que ya empezó conserva el cargo con el que se inició', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      const buyer = await createUser(t.prisma);
      const started = await checkout(buyer, ticketType.id).expect(201);

      await changeFee(await createAdmin(), event.id, {
        percentage: 8,
      }).expect(200);

      const order = await t.prisma.order.findUniqueOrThrow({
        where: { id: (started.body as { orderId: string }).orderId },
      });
      expect(order.serviceFee.toFixed(2)).toBe('150.00');
      expect(order.totalAmount.toFixed(2)).toBe('1150.00');
    });

    it('con 0 % la compra sale sin cargo: Mercado Pago no recibe un ítem de $0 ni marketplace_fee', async () => {
      const { event, ticketType } = await createOrganizerWithEvent(t.prisma, {
        price: 1000,
      });
      await changeFee(await createAdmin(), event.id, {
        percentage: 0,
      }).expect(200);
      const buyer = await createUser(t.prisma);

      const started = await checkout(buyer, ticketType.id).expect(201);

      const order = await t.prisma.order.findUniqueOrThrow({
        where: { id: (started.body as { orderId: string }).orderId },
      });
      expect(order.serviceFee.toFixed(2)).toBe('0.00');
      const preference = lastPreference();
      expect(preference.items.map((item) => item.id)).toEqual([ticketType.id]);
      expect(preference.marketplace_fee).toBeUndefined();
    });

    it('acepta el máximo: 100 %', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      await changeFee(await createAdmin(), event.id, {
        percentage: 100,
      }).expect(200);

      expect(await feeOf(event.id)).toBe('100');
    });

    it.each([
      ['negativo', { percentage: -1 }],
      ['mayor a 100', { percentage: 100.01 }],
      ['con más de 2 decimales', { percentage: 8.555 }],
      ['escrito como texto', { percentage: '8' }],
      ['vacío', { percentage: '' }],
      ['nulo', { percentage: null }],
      ['sin el campo', {}],
    ])('rechaza un cargo %s', async (_, body) => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      await changeFee(await createAdmin(), event.id, body).expect(400);

      expect(await feeOf(event.id)).toBe('15');
    });

    it('un evento que no existe responde 404', async () => {
      const admin = await createAdmin();

      await changeFee(admin, MISSING_ID, { percentage: 8 }).expect(404);
      await changeFee(admin, 'no-es-un-id', { percentage: 8 }).expect(404);
    });

    it.each([
      ['terminó', { status: 'FINISHED' as const }],
      ['se canceló', { status: 'CANCELLED' as const }],
      ['se eliminó', { deletedAt: new Date() }],
      [
        'ya pasó su fin',
        {
          startDate: new Date(Date.now() - 2 * DAY_MS),
          endDate: new Date(Date.now() - DAY_MS),
        },
      ],
    ])(
      'no cambia el cargo de un evento que %s: ya no vende (409)',
      async (_, data) => {
        const { event } = await createOrganizerWithEvent(t.prisma);
        await t.prisma.event.update({ where: { id: event.id }, data });

        await changeFee(await createAdmin(), event.id, {
          percentage: 8,
        }).expect(409);

        expect(await feeOf(event.id)).toBe('15');
      },
    );
  });

  describe('la base de datos', () => {
    it('los eventos nuevos nacen con 15 %', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      expect(event.neoPassFeePercentage.toString()).toBe('15');
    });

    it('rechaza un cargo fuera de 0–100 aunque se cambie por SQL', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);

      for (const fee of [150, -1]) {
        await expect(
          t.prisma
            .$executeRaw`UPDATE "Event" SET "neoPassFeePercentage" = ${fee} WHERE id = ${event.id}`,
        ).rejects.toThrow(/Event_neoPassFeePercentage_range/);
      }
      expect(await feeOf(event.id)).toBe('15');
    });
  });
});
