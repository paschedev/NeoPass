import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createTicket,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MyTicketBody = {
  id: string;
  status: string;
  qrCode: string;
  ticketType: { name: string; event: Record<string, unknown> };
};

describe('Mis entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function myTickets(user: Parameters<typeof authHeader>[1]) {
    const res = await request(t.app.getHttpServer())
      .get('/tickets/my-tickets')
      .set('Authorization', authHeader(t.app, user))
      .expect(200);
    return res.body as MyTicketBody[];
  }

  it('cada entrada trae cuándo empieza y termina el evento y su estado, sin datos internos del evento', async () => {
    const { event, ticketType } = await createOrganizerWithEvent(t.prisma);
    const owner = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: owner,
      ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order, ticketType });

    const [ticket] = await myTickets(owner);

    expect(ticket.ticketType.event).toEqual({
      title: event.title,
      startDate: event.startDate.toISOString(),
      endDate: event.endDate.toISOString(),
      status: 'PUBLISHED',
      venueName: null,
    });
  });

  it('solo trae las entradas propias', async () => {
    const { ticketType } = await createOrganizerWithEvent(t.prisma);
    const owner = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: owner,
      ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order, ticketType });

    expect(await myTickets(await createUser(t.prisma))).toEqual([]);
  });
});
