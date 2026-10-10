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

type User = Parameters<typeof authHeader>[1];

describe('Quién organiza: la productora o, sin productora, el nombre de la cuenta', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());

  // An event whose organizer is "Agustín Zannantonio", with that producer
  // name (null: an organizer profile without one; undefined: no profile).
  async function eventBy(companyName?: string | null) {
    const created = await createOrganizerWithEvent(t.prisma);
    await t.prisma.user.update({
      where: { id: created.organizer.id },
      data: {
        name: 'Agustín Zannantonio',
        ...(companyName !== undefined && {
          organizerProfile: {
            create: { phone: '+541123456789', companyName },
          },
        }),
      },
    });
    return created;
  }

  const get = (user: User, path: string) =>
    http().get(path).set('Authorization', authHeader(t.app, user)).expect(200);

  it('la página del evento dice quién organiza', async () => {
    const withCompany = await eventBy('Productora Sur');
    const withoutCompany = await eventBy(null);
    const withoutProfile = await eventBy();

    const names = [];
    for (const { event } of [withCompany, withoutCompany, withoutProfile]) {
      const res = await http().get(`/events/${event.id}`).expect(200);
      expect(res.body).not.toHaveProperty('organizer');
      names.push((res.body as { organizerName: string }).organizerName);
    }

    expect(names).toEqual([
      'Productora Sur',
      'Agustín Zannantonio',
      'Agustín Zannantonio',
    ]);
  });

  it('el mail de QR free sale con el nombre de la productora', async () => {
    const { organizer, event, ticketType } = await eventBy('Productora Sur');

    await http()
      .post(`/events/organizer/${event.id}/free-tickets`)
      .set('Authorization', authHeader(t.app, organizer))
      .send({
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'amiga@neopass.test',
      })
      .expect(201);

    const [, job] = t.queues.mail.add.mock.calls.find(
      ([name]) => name === 'send-free-tickets',
    ) as [string, { organizerName: string }];
    expect(job.organizerName).toBe('Productora Sur');
  });

  it('Staff muestra la productora en los eventos y en las invitaciones', async () => {
    const worker = await createUser(t.prisma);
    const accepted = await eventBy('Productora Sur');
    const pending = await eventBy('Productora Norte');
    await t.prisma.eventStaff.create({
      data: {
        eventId: accepted.event.id,
        userId: worker.id,
        role: 'SCANNER',
        status: 'ACCEPTED',
      },
    });
    await t.prisma.eventStaff.create({
      data: { eventId: pending.event.id, userId: worker.id, role: 'SCANNER' },
    });

    const res = await get(worker, '/events/staff/me');

    const body = res.body as {
      events: { organizerName: string }[];
      invitations: { event: { organizerName: string } }[];
    };
    expect(body.events[0].organizerName).toBe('Productora Sur');
    expect(body.invitations[0].event.organizerName).toBe('Productora Norte');
  });

  it('el aviso de evento eliminado en Mis entradas nombra a la productora', async () => {
    const { organizer, event, ticketType } = await eventBy('Productora Sur');
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      status: 'PAID',
    });
    await createTicket(t.prisma, { order, ticketType });
    await t.prisma.event.update({
      where: { id: event.id },
      data: {
        deletedAt: new Date(),
        deletedById: organizer.id,
        deletionContactEmail: 'reclamos@productora.test',
      },
    });

    const res = await get(buyer, '/tickets/my-tickets');

    const [ticket] = res.body as {
      ticketType: { event: { deletion: { organizerName: string } } };
    }[];
    expect(ticket.ticketType.event.deletion.organizerName).toBe(
      'Productora Sur',
    );
  });
});
