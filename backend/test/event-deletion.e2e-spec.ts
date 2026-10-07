import request from 'supertest';
import { mercadoPagoMock } from './mocks/mercadopago';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type User = Parameters<typeof authHeader>[1];
type Deletion = {
  byNeoPass: boolean;
  organizerName: string;
  contactEmail: string;
} | null;
type MyTicketBody = {
  id: string;
  ticketType: { event: { title: string; deletion: Deletion } };
};

describe('Eliminar un evento', () => {
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

  // Evento publicado con una entrada vendida.
  async function eventWithSale() {
    const created = await createOrganizerWithEvent(t.prisma);
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType: created.ticketType,
      status: 'PAID',
    });
    const ticket = await createTicket(t.prisma, {
      order,
      ticketType: created.ticketType,
    });
    return { ...created, buyer, ticket };
  }

  function deleteEvent(user: User, eventId: string, body: object = {}) {
    return http()
      .delete(`/events/${eventId}`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  async function myTickets(user: User) {
    const res = await http()
      .get('/tickets/my-tickets')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    return res.body as MyTicketBody[];
  }

  describe('el organizador', () => {
    it('elimina su evento y deja de verse en el sitio público', async () => {
      const { organizer, event } = await eventWithSale();

      await deleteEvent(organizer, event.id).expect(200);

      const list = await http().get('/events').expect(200);
      expect((list.body as { items: unknown[] }).items).toEqual([]);
      await http().get(`/events/${event.id}`).expect(404);
    });

    it('después de eliminarlo nadie puede comprar entradas', async () => {
      const { organizer, event, ticketType } = await eventWithSale();
      await deleteEvent(organizer, event.id).expect(200);

      await http()
        .post('/orders/checkout')
        .set('Authorization', authHeader(t.app, await createUser(t.prisma)))
        .send({
          captchaToken: 'captcha-de-prueba',
          items: [{ ticketTypeId: ticketType.id, quantity: 1 }],
        })
        .expect(409);
    });

    it('las ventas siguen registradas: lo sigue viendo en sus eventos, marcado como eliminado y con sus ingresos', async () => {
      const { organizer, event } = await eventWithSale();
      await deleteEvent(organizer, event.id).expect(200);

      const res = await http()
        .get('/events/organizer/me')
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);
      const [mine] = res.body as {
        id: string;
        deletedAt: string | null;
        revenue: number;
      }[];
      expect(mine.id).toBe(event.id);
      expect(mine.deletedAt).not.toBeNull();
      expect(mine.revenue).toBe(1000);
    });

    it('quien compró conserva su entrada con el aviso y el email de contacto que eligió el organizador', async () => {
      const { organizer, event, buyer } = await eventWithSale();

      await deleteEvent(organizer, event.id, {
        contactEmail: 'reclamos@productora.test',
      }).expect(200);

      const [ticket] = await myTickets(buyer);
      expect(ticket.ticketType.event.deletion).toEqual({
        byNeoPass: false,
        organizerName: 'Usuario de prueba',
        contactEmail: 'reclamos@productora.test',
      });
    });

    it('sin un email elegido, el aviso muestra el email de su cuenta', async () => {
      const { organizer, event, buyer } = await eventWithSale();

      await deleteEvent(organizer, event.id).expect(200);

      const [ticket] = await myTickets(buyer);
      expect(ticket.ticketType.event.deletion?.contactEmail).toBe(
        organizer.email,
      );
    });

    it('quien tiene entradas recibe un aviso', async () => {
      const { organizer, event, buyer } = await eventWithSale();

      await deleteEvent(organizer, event.id).expect(200);

      const notices = await t.prisma.notification.findMany({
        where: { userId: buyer.id },
      });
      expect(notices).toHaveLength(1);
      expect(notices[0].title).toContain(event.title);
    });

    it('un email de contacto mal escrito se rechaza y el evento sigue publicado', async () => {
      const { organizer, event } = await eventWithSale();

      await deleteEvent(organizer, event.id, {
        contactEmail: 'no-es-un-email',
      }).expect(400);

      await http().get(`/events/${event.id}`).expect(200);
    });

    it('eliminarlo dos veces responde que ya fue eliminado', async () => {
      const { organizer, event } = await eventWithSale();
      await deleteEvent(organizer, event.id).expect(200);

      await deleteEvent(organizer, event.id).expect(409);
    });
  });

  describe('un evento eliminado', () => {
    async function deletedEventWithSale() {
      const sale = await eventWithSale();
      await deleteEvent(sale.organizer, sale.event.id).expect(200);
      return sale;
    }

    it('no se puede editar', async () => {
      const { organizer, event } = await deletedEventWithSale();

      await http()
        .put(`/events/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send({ title: 'Otro nombre' })
        .expect(409);
    });

    it('en la puerta sus entradas no pasan', async () => {
      const { organizer, ticket } = await deletedEventWithSale();

      const res = await http()
        .post('/tickets/check-in')
        .set('Authorization', authHeader(t.app, organizer))
        .send({ qrCode: ticket.qrCode })
        .expect(201);

      expect((res.body as { status: string }).status).toBe('EVENT_CLOSED');
    });

    it('sus entradas no se pueden transferir', async () => {
      const { buyer, ticket } = await deletedEventWithSale();
      const recipient = await createUser(t.prisma);

      await http()
        .post(`/tickets/${ticket.id}/transfer`)
        .set('Authorization', authHeader(t.app, buyer))
        .send({ targetUserId: recipient.id })
        .expect(409);
    });

    it('su staff lo sigue viendo en su panel', async () => {
      const { event } = await deletedEventWithSale();
      const scanner = await createUser(t.prisma);
      await t.prisma.eventStaff.create({
        data: {
          eventId: event.id,
          userId: scanner.id,
          role: 'SCANNER',
          status: 'ACCEPTED',
        },
      });

      const res = await http()
        .get('/events/staff/me')
        .set('Authorization', authHeader(t.app, scanner))
        .expect(200);

      expect(
        (res.body as { events: { id: string }[] }).events.map((e) => e.id),
      ).toEqual([event.id]);
    });
  });

  describe('quién puede', () => {
    it('un co-organizador no lo puede eliminar', async () => {
      const { event } = await eventWithSale();
      const coOrganizer = await createUser(t.prisma);
      await t.prisma.eventStaff.create({
        data: {
          eventId: event.id,
          userId: coOrganizer.id,
          role: 'MANAGER',
          status: 'ACCEPTED',
          permissions: ['EDIT_EVENT', 'MANAGE_BATCHES'],
        },
      });

      await deleteEvent(coOrganizer, event.id).expect(403);
      await http().get(`/events/${event.id}`).expect(200);
    });

    it('una cuenta ajena no lo encuentra y el evento sigue publicado', async () => {
      const { event } = await eventWithSale();

      await deleteEvent(await createUser(t.prisma), event.id).expect(404);
      await http().get(`/events/${event.id}`).expect(200);
    });

    it('una cuenta ADMIN da de baja un evento ajeno y el aviso dice que fue NeoPass, con el email del organizador', async () => {
      const { organizer, event, buyer } = await eventWithSale();
      const admin = await createUser(t.prisma, { role: 'ADMIN' });

      await deleteEvent(admin, event.id, {
        contactEmail: 'admin@neopass.test',
      }).expect(200);

      await http().get(`/events/${event.id}`).expect(404);
      const [ticket] = await myTickets(buyer);
      expect(ticket.ticketType.event.deletion).toEqual({
        byNeoPass: true,
        organizerName: 'Usuario de prueba',
        contactEmail: organizer.email,
      });
    });
  });
});
