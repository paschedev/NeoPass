import { EventStatus, User } from '@prisma/client';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * HOUR_MS);
}

type FreeTicketsJob = {
  to: string;
  name: string | null;
  organizerName: string;
  validUntil: string | null;
  tickets: { qrCode: string; ticketTypeName: string; eventName: string }[];
};

type MailCall = [string, FreeTicketsJob, { jobId?: string }];

type GrantResponse = {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  ticketType: { id: string; name: string };
  quantity: number;
  checkedIn: number;
  status: 'ACTIVE' | 'CANCELLED';
  validUntil: string | null;
  createdAt: string;
};

type CheckInResponse = {
  success: boolean;
  status: string;
  isGuestList?: boolean;
  validUntil?: string;
};

describe('QR free', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  // By default the event is in progress: it started an hour ago and ends in 5.
  async function organizerEvent({
    status = 'PUBLISHED',
    startsInHours = -1,
    endsInHours = 5,
  }: {
    status?: EventStatus;
    startsInHours?: number;
    endsInHours?: number;
  } = {}) {
    const created = await createOrganizerWithEvent(t.prisma);
    const event = await t.prisma.event.update({
      where: { id: created.event.id },
      data: {
        status,
        startDate: hoursFromNow(startsInHours),
        endDate: hoursFromNow(endsInHours),
      },
    });
    return { ...created, event };
  }

  function send(user: User, eventId: string, body: Record<string, unknown>) {
    return request(t.app.getHttpServer())
      .post(`/events/organizer/${eventId}/free-tickets`)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  function list(user: User, eventId: string) {
    return request(t.app.getHttpServer())
      .get(`/events/organizer/${eventId}/free-tickets`)
      .set('Authorization', authHeader(t.app, user));
  }

  function action(
    user: User,
    eventId: string,
    grantId: string,
    name: 'cancel' | 'resend',
  ) {
    return request(t.app.getHttpServer())
      .post(`/events/organizer/${eventId}/free-tickets/${grantId}/${name}`)
      .set('Authorization', authHeader(t.app, user));
  }

  function checkIn(user: User, qrCode: string) {
    return request(t.app.getHttpServer())
      .post('/tickets/check-in')
      .set('Authorization', authHeader(t.app, user))
      .send({ qrCode });
  }

  function mailCalls() {
    return t.queues.mail.add.mock.calls as MailCall[];
  }

  function grantTickets(grantId: string) {
    return t.prisma.ticket.findMany({
      where: { freeTicketGrantId: grantId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function sentGrant(quantity = 3, extra: Record<string, unknown> = {}) {
    const setup = await organizerEvent();
    const res = await send(setup.organizer, setup.event.id, {
      ticketTypeId: setup.ticketType.id,
      quantity,
      email: 'invitada@example.com',
      ...extra,
    }).expect(201);
    const grant = res.body as GrantResponse;
    return { ...setup, grant, tickets: await grantTickets(grant.id) };
  }

  describe('enviar', () => {
    it('crea las entradas válidas sin tocar el stock y manda un solo mail con todos los QR', async () => {
      const { organizer, event, ticketType } = await organizerEvent();

      const res = await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 3,
        email: '  Invitada@Example.com ',
        name: 'Ana',
      }).expect(201);

      const grant = res.body as GrantResponse;
      expect(grant).toMatchObject({
        recipientEmail: 'invitada@example.com',
        recipientName: 'Ana',
        ticketType: { id: ticketType.id, name: ticketType.name },
        quantity: 3,
        checkedIn: 0,
        status: 'ACTIVE',
        validUntil: null,
      });
      const tickets = await grantTickets(grant.id);
      expect(tickets).toHaveLength(3);
      for (const ticket of tickets) {
        expect(ticket).toMatchObject({
          status: 'VALID',
          isGuestList: true,
          userId: null,
          orderId: null,
          ticketTypeId: ticketType.id,
        });
      }
      const stored = await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      });
      expect(stored).toMatchObject({
        stock: ticketType.stock,
        sold: 0,
        reserved: 0,
      });

      expect(mailCalls()).toHaveLength(1);
      const [name, job] = mailCalls()[0];
      expect(name).toBe('send-free-tickets');
      expect(job).toMatchObject({
        to: 'invitada@example.com',
        name: 'Ana',
        organizerName: organizer.name,
        validUntil: null,
      });
      expect(job.tickets.map((ticket) => ticket.qrCode).sort()).toEqual(
        tickets.map((ticket) => ticket.qrCode).sort(),
      );
    });

    it.each([
      ['cantidad 0', { quantity: 0 }],
      ['cantidad 11', { quantity: 11 }],
      ['cantidad con decimales', { quantity: 2.5 }],
      ['correo inválido', { email: 'no-es-un-correo' }],
      ['sin tipo de entrada', { ticketTypeId: undefined }],
      ['nombre de más de 60 caracteres', { name: 'a'.repeat(61) }],
      ['hora límite que no es una fecha', { validUntil: 'mañana' }],
    ])('rechaza el envío con %s', async (_case, override) => {
      const { organizer, event, ticketType } = await organizerEvent();

      await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 2,
        email: 'invitada@example.com',
        ...override,
      }).expect(400);

      expect(await t.prisma.ticket.count()).toBe(0);
      expect(t.queues.mail.add).not.toHaveBeenCalled();
    });

    it('un tipo de entrada de otro evento no existe para este', async () => {
      const { organizer, event } = await organizerEvent();
      const other = await organizerEvent();

      await send(organizer, event.id, {
        ticketTypeId: other.ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(404);

      expect(await t.prisma.ticket.count()).toBe(0);
    });

    it('no se pueden mandar QR free de un evento de otro organizador', async () => {
      const { event, ticketType } = await organizerEvent();
      const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

      await send(intruder, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(404);

      expect(await t.prisma.ticket.count()).toBe(0);
    });

    it.each([
      ['finalizado', { status: 'FINISHED' as EventStatus }],
      ['cancelado', { status: 'CANCELLED' as EventStatus }],
      ['en borrador', { status: 'DRAFT' as EventStatus }],
      ['cuyo fin ya pasó', { startsInHours: -7, endsInHours: -1 }],
    ])('no se pueden mandar QR free de un evento %s', async (_case, setup) => {
      const { organizer, event, ticketType } = await organizerEvent(setup);

      await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(409);

      expect(await t.prisma.ticket.count()).toBe(0);
    });

    it('un comprador no puede mandar QR free', async () => {
      const { event, ticketType } = await organizerEvent();
      const buyer = await createUser(t.prisma);

      await send(buyer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(403);
    });

    it('sin sesión no se pueden mandar QR free', async () => {
      const { event, ticketType } = await organizerEvent();

      await request(t.app.getHttpServer())
        .post(`/events/organizer/${event.id}/free-tickets`)
        .send({
          ticketTypeId: ticketType.id,
          quantity: 1,
          email: 'invitada@example.com',
        })
        .expect(401);
    });
  });

  describe('hora límite de ingreso', () => {
    it('se guarda si cae dentro del evento y viaja en el mail', async () => {
      const { organizer, event, ticketType } = await organizerEvent();
      const validUntil = hoursFromNow(2).toISOString();

      const res = await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 2,
        email: 'invitada@example.com',
        validUntil,
      }).expect(201);

      expect((res.body as GrantResponse).validUntil).toBe(validUntil);
      expect(mailCalls()[0][1].validUntil).toBe(validUntil);
    });

    it.each([
      ['antes del inicio', { startsInHours: 3, endsInHours: 9 }, 2],
      ['después del fin', { startsInHours: -1, endsInHours: 5 }, 6],
      ['que ya pasó', { startsInHours: -3, endsInHours: 5 }, -1],
    ])(
      'rechaza una hora límite %s',
      async (_case, eventSetup, validUntilInHours) => {
        const { organizer, event, ticketType } =
          await organizerEvent(eventSetup);

        await send(organizer, event.id, {
          ticketTypeId: ticketType.id,
          quantity: 1,
          email: 'invitada@example.com',
          validUntil: hoursFromNow(validUntilInHours).toISOString(),
        }).expect(400);

        expect(await t.prisma.ticket.count()).toBe(0);
      },
    );
  });

  describe('en la puerta', () => {
    it('un QR free válido entra y se informa como QR free', async () => {
      const { organizer, tickets } = await sentGrant(1);

      const res = await checkIn(organizer, tickets[0].qrCode).expect(201);

      const body = res.body as CheckInResponse;
      expect(body.status).toBe('VALID');
      expect(body.isGuestList).toBe(true);
    });

    it('después de su hora límite sale vencida y no se marca como usada', async () => {
      const { organizer, grant, tickets } = await sentGrant(1, {
        validUntil: hoursFromNow(2).toISOString(),
      });
      const validUntil = new Date(Date.now() - MINUTE_MS);
      await t.prisma.freeTicketGrant.update({
        where: { id: grant.id },
        data: { validUntil },
      });

      const res = await checkIn(organizer, tickets[0].qrCode).expect(201);

      const body = res.body as CheckInResponse;
      expect(body.success).toBe(false);
      expect(body.status).toBe('EXPIRED');
      expect(body.validUntil).toBe(validUntil.toISOString());
      const stored = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: tickets[0].id },
      });
      expect(stored.status).toBe('VALID');
    });

    it('los que ingresaron con QR free cuentan en "ingresaron" pero no en vendidas ni en lo recaudado', async () => {
      const { organizer, event, tickets } = await sentGrant(2);
      await checkIn(organizer, tickets[0].qrCode).expect(201);

      const res = await request(t.app.getHttpServer())
        .get(`/events/organizer/${event.id}/sales`)
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);

      expect(
        (res.body as { totals: Record<string, number> }).totals,
      ).toMatchObject({ checkedIn: 1, sold: 0, revenue: 0 });
    });
  });

  describe('anular', () => {
    it('invalida las entradas del envío que no se usaron y deja las usadas', async () => {
      const { organizer, event, grant, tickets } = await sentGrant(3);
      await checkIn(organizer, tickets[0].qrCode).expect(201);

      const res = await action(organizer, event.id, grant.id, 'cancel').expect(
        201,
      );

      expect((res.body as GrantResponse).status).toBe('CANCELLED');
      const stored = await grantTickets(grant.id);
      expect(stored.map((ticket) => ticket.status).sort()).toEqual([
        'CANCELLED',
        'CANCELLED',
        'USED',
      ]);
      const atTheDoor = await checkIn(organizer, tickets[1].qrCode).expect(201);
      expect((atTheDoor.body as CheckInResponse).status).toBe('INVALID');
    });

    it('un envío ya anulado no se vuelve a anular', async () => {
      const { organizer, event, grant } = await sentGrant(1);
      await action(organizer, event.id, grant.id, 'cancel').expect(201);

      await action(organizer, event.id, grant.id, 'cancel').expect(409);
    });

    it('no se puede anular un envío de otro organizador', async () => {
      const { grant, tickets } = await sentGrant(1);
      const other = await organizerEvent();

      await action(other.organizer, other.event.id, grant.id, 'cancel').expect(
        404,
      );

      const stored = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: tickets[0].id },
      });
      expect(stored.status).toBe('VALID');
    });

    it('anular y escanear a la vez deja la entrada usada o anulada, nunca las dos cosas', async () => {
      const { organizer, event, grant, tickets } = await sentGrant(1);

      const [, scan] = await Promise.all([
        action(organizer, event.id, grant.id, 'cancel'),
        checkIn(organizer, tickets[0].qrCode),
      ]);

      const stored = await t.prisma.ticket.findUniqueOrThrow({
        where: { id: tickets[0].id },
      });
      const checkIns = await t.prisma.checkIn.count({
        where: { ticketId: tickets[0].id },
      });
      if ((scan.body as CheckInResponse).status === 'VALID') {
        expect(stored.status).toBe('USED');
        expect(checkIns).toBe(1);
      } else {
        expect(stored.status).toBe('CANCELLED');
        expect(checkIns).toBe(0);
      }
    });
  });

  describe('reenviar', () => {
    async function allowResend(grantId: string) {
      await t.prisma.freeTicketGrant.update({
        where: { id: grantId },
        data: { lastSentAt: new Date(Date.now() - 11 * MINUTE_MS) },
      });
    }

    it('manda otra vez el mail con los QR que siguen vigentes', async () => {
      const { organizer, event, grant, tickets } = await sentGrant(3);
      await checkIn(organizer, tickets[0].qrCode).expect(201);
      await allowResend(grant.id);

      await action(organizer, event.id, grant.id, 'resend').expect(201);

      expect(mailCalls()).toHaveLength(2);
      const [[, , first], [name, job, second]] = mailCalls();
      expect(name).toBe('send-free-tickets');
      expect(job.to).toBe('invitada@example.com');
      expect(job.tickets.map((ticket) => ticket.qrCode).sort()).toEqual(
        [tickets[1].qrCode, tickets[2].qrCode].sort(),
      );
      expect(second.jobId).not.toBe(first.jobId);
    });

    it('un envío anulado no se reenvía', async () => {
      const { organizer, event, grant } = await sentGrant(1);
      await action(organizer, event.id, grant.id, 'cancel').expect(201);
      await allowResend(grant.id);

      await action(organizer, event.id, grant.id, 'resend').expect(409);
    });

    it('si todas las entradas ya se usaron no hay nada que reenviar', async () => {
      const { organizer, event, grant, tickets } = await sentGrant(1);
      await checkIn(organizer, tickets[0].qrCode).expect(201);
      await allowResend(grant.id);

      await action(organizer, event.id, grant.id, 'resend').expect(409);
    });

    it('no se puede reenviar el mismo envío antes de 10 minutos', async () => {
      const { organizer, event, grant } = await sentGrant(1);

      await action(organizer, event.id, grant.id, 'resend').expect(429);

      expect(mailCalls()).toHaveLength(1);
    });
  });

  describe('límite de envíos', () => {
    async function previousGrants(
      organizerId: string,
      eventId: string,
      ticketTypeId: string,
      createdAt: Date,
    ) {
      await t.prisma.freeTicketGrant.createMany({
        data: Array.from({ length: 30 }, (_, i) => ({
          eventId,
          ticketTypeId,
          issuedById: organizerId,
          recipientEmail: `invitado${i}@example.com`,
          createdAt,
          lastSentAt: createdAt,
        })),
      });
    }

    it('el envío 31 de un organizador en la misma hora se rechaza', async () => {
      const { organizer, event, ticketType } = await organizerEvent();
      await previousGrants(
        organizer.id,
        event.id,
        ticketType.id,
        new Date(Date.now() - 30 * MINUTE_MS),
      );

      await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(429);

      expect(t.queues.mail.add).not.toHaveBeenCalled();
    });

    it('los envíos de hace más de una hora no cuentan', async () => {
      const { organizer, event, ticketType } = await organizerEvent();
      await previousGrants(
        organizer.id,
        event.id,
        ticketType.id,
        new Date(Date.now() - 61 * MINUTE_MS),
      );

      await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'invitada@example.com',
      }).expect(201);
    });
  });

  describe('listado', () => {
    it('muestra los envíos del evento, el más nuevo primero, sin los QR', async () => {
      const { organizer, event, ticketType, grant, tickets } =
        await sentGrant(2);
      await checkIn(organizer, tickets[0].qrCode).expect(201);
      const second = await send(organizer, event.id, {
        ticketTypeId: ticketType.id,
        quantity: 1,
        email: 'otra@example.com',
      }).expect(201);
      await action(
        organizer,
        event.id,
        (second.body as GrantResponse).id,
        'cancel',
      ).expect(201);

      const res = await list(organizer, event.id).expect(200);

      const grants = res.body as GrantResponse[];
      expect(grants.map((item) => item.recipientEmail)).toEqual([
        'otra@example.com',
        'invitada@example.com',
      ]);
      expect(grants[0]).toMatchObject({ status: 'CANCELLED', quantity: 1 });
      expect(grants[1]).toMatchObject({
        id: grant.id,
        status: 'ACTIVE',
        quantity: 2,
        checkedIn: 1,
        ticketType: { id: ticketType.id, name: ticketType.name },
      });
      const allQrCodes = await t.prisma.ticket.findMany({
        select: { qrCode: true },
      });
      for (const { qrCode } of allQrCodes) {
        expect(JSON.stringify(res.body)).not.toContain(qrCode);
      }
    });

    it('no se pueden ver los envíos de un evento de otro organizador', async () => {
      const { event } = await sentGrant(1);
      const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

      await list(intruder, event.id).expect(404);
    });
  });
});
