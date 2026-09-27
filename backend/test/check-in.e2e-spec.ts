import { EventStatus } from '@prisma/client';
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

type CheckInResponse = { success: boolean; status: string };

describe('Check-in en la puerta', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function soldTicket(eventStatus: EventStatus = 'PUBLISHED') {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    await t.prisma.event.update({
      where: { id: event.id },
      data: { status: eventStatus },
    });
    const buyer = await createUser(t.prisma);
    const order = await createOrder(t.prisma, {
      user: buyer,
      ticketType,
      status: 'PAID',
    });
    const ticket = await createTicket(t.prisma, { order, ticketType });
    return { organizer, event, ticket };
  }

  function checkIn(user: Parameters<typeof authHeader>[1], qrCode: string) {
    return request(t.app.getHttpServer())
      .post('/tickets/check-in')
      .set('Authorization', authHeader(t.app, user))
      .send({ qrCode });
  }

  async function ticketStatus(id: string) {
    return (await t.prisma.ticket.findUniqueOrThrow({ where: { id } })).status;
  }

  it('el organizador valida una entrada y queda usada', async () => {
    const { organizer, ticket } = await soldTicket();

    const res = await checkIn(organizer, ticket.qrCode).expect(201);

    expect((res.body as CheckInResponse).status).toBe('VALID');
    expect(await ticketStatus(ticket.id)).toBe('USED');
    expect(
      await t.prisma.checkIn.count({ where: { ticketId: ticket.id } }),
    ).toBe(1);
  });

  it('dos escaneos a la vez de la misma entrada: uno válido y otro usado', async () => {
    const { organizer, ticket } = await soldTicket();

    const responses = await Promise.all([
      checkIn(organizer, ticket.qrCode),
      checkIn(organizer, ticket.qrCode),
    ]);

    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(
      responses.map((r) => (r.body as CheckInResponse).status).sort(),
    ).toEqual(['USED', 'VALID']);
    expect(
      await t.prisma.checkIn.count({ where: { ticketId: ticket.id } }),
    ).toBe(1);
  });

  it.each(['CANCELLED', 'FINISHED'] as const)(
    'una entrada de un evento %s no se valida',
    async (eventStatus) => {
      const { organizer, ticket } = await soldTicket(eventStatus);

      const res = await checkIn(organizer, ticket.qrCode).expect(201);

      expect((res.body as CheckInResponse).success).toBe(false);
      expect((res.body as CheckInResponse).status).toBe('EVENT_CLOSED');
      expect(await ticketStatus(ticket.id)).toBe('VALID');
    },
  );

  it('un scanner aceptado del evento puede validar', async () => {
    const { event, ticket } = await soldTicket();
    const scanner = await createUser(t.prisma);
    await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: scanner.id,
        role: 'SCANNER',
        status: 'ACCEPTED',
      },
    });

    const res = await checkIn(scanner, ticket.qrCode).expect(201);

    expect((res.body as CheckInResponse).status).toBe('VALID');
  });

  it('alguien sin permiso sobre el evento no puede validar', async () => {
    const { ticket } = await soldTicket();
    const stranger = await createUser(t.prisma);

    const res = await checkIn(stranger, ticket.qrCode).expect(201);

    expect((res.body as CheckInResponse).status).toBe('WRONG_EVENT');
    expect(await ticketStatus(ticket.id)).toBe('VALID');
  });
});
