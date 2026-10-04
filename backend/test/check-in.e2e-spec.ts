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

type CheckInResponse = { success: boolean; status: string; opensAt?: string };

const HOUR_MS = 60 * 60 * 1000;

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * HOUR_MS);
}

describe('Check-in en la puerta', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  // By default the event is in progress: it started an hour ago.
  async function soldTicket(
    eventStatus: EventStatus = 'PUBLISHED',
    { startsInHours = -1, endsInHours = 5 } = {},
  ) {
    const { organizer, event, ticketType } = await createOrganizerWithEvent(
      t.prisma,
    );
    await t.prisma.event.update({
      where: { id: event.id },
      data: {
        status: eventStatus,
        startDate: hoursFromNow(startsInHours),
        endDate: hoursFromNow(endsInHours),
      },
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

  it('una entrada de un evento cuyo fin ya pasó no se valida aunque siga publicado', async () => {
    const { organizer, ticket } = await soldTicket('PUBLISHED', {
      startsInHours: -7,
      endsInHours: -1,
    });

    const res = await checkIn(organizer, ticket.qrCode).expect(201);

    expect((res.body as CheckInResponse).status).toBe('EVENT_CLOSED');
    expect(await ticketStatus(ticket.id)).toBe('VALID');
  });

  describe('antes del inicio', () => {
    it('más de 2 horas antes del inicio la entrada no se usa y se avisa desde cuándo se puede escanear', async () => {
      const { organizer, event, ticket } = await soldTicket('PUBLISHED', {
        startsInHours: 3,
        endsInHours: 9,
      });

      const res = await checkIn(organizer, ticket.qrCode).expect(201);

      const body = res.body as CheckInResponse;
      expect(body.success).toBe(false);
      expect(body.status).toBe('NOT_STARTED');
      const { startDate } = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(body.opensAt).toBe(
        new Date(startDate.getTime() - 2 * HOUR_MS).toISOString(),
      );
      expect(await ticketStatus(ticket.id)).toBe('VALID');
      expect(
        await t.prisma.checkIn.count({ where: { ticketId: ticket.id } }),
      ).toBe(0);
    });

    it('dentro de las 2 horas previas al inicio la entrada ya se valida', async () => {
      const { organizer, ticket } = await soldTicket('PUBLISHED', {
        startsInHours: 1,
        endsInHours: 7,
      });

      const res = await checkIn(organizer, ticket.qrCode).expect(201);

      expect((res.body as CheckInResponse).status).toBe('VALID');
      expect(await ticketStatus(ticket.id)).toBe('USED');
    });

    it('la entrada escaneada antes de tiempo entra cuando se abre el ingreso', async () => {
      const { organizer, event, ticket } = await soldTicket('PUBLISHED', {
        startsInHours: 3,
        endsInHours: 9,
      });
      await checkIn(organizer, ticket.qrCode).expect(201);

      await t.prisma.event.update({
        where: { id: event.id },
        data: { startDate: hoursFromNow(1) },
      });
      const res = await checkIn(organizer, ticket.qrCode).expect(201);

      expect((res.body as CheckInResponse).status).toBe('VALID');
    });

    it('alguien de otro evento ve "otro evento" y no el horario de ingreso', async () => {
      const { ticket } = await soldTicket('PUBLISHED', {
        startsInHours: 3,
        endsInHours: 9,
      });
      const stranger = await createUser(t.prisma);

      const res = await checkIn(stranger, ticket.qrCode).expect(201);

      expect((res.body as CheckInResponse).status).toBe('WRONG_EVENT');
      expect((res.body as CheckInResponse).opensAt).toBeUndefined();
    });

    it('una entrada anulada sale inválida aunque el ingreso todavía no abra', async () => {
      const { organizer, ticket } = await soldTicket('PUBLISHED', {
        startsInHours: 3,
        endsInHours: 9,
      });
      await t.prisma.ticket.update({
        where: { id: ticket.id },
        data: { status: 'REFUNDED' },
      });

      const res = await checkIn(organizer, ticket.qrCode).expect(201);

      expect((res.body as CheckInResponse).status).toBe('INVALID');
    });
  });

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
