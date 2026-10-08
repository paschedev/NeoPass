import { EventPermission, User } from '@prisma/client';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type Quota = { limit: number; sent: number } | null;
type OverviewBody = {
  events: { id: string; promoters: { id: string; freeTickets: Quota }[] }[];
};
type MyStaffBody = {
  invitations: { id: string; freeTicketLimit: number | null }[];
  events: { id: string; promoter: { freeTickets: Quota } | null }[];
};

const NO_PERMISSION = 'No tenés permiso para mandar QR free';
const OWNER_ONLY =
  'Solo quien organiza el evento puede habilitar QR free a un RPP';

describe('QR free de los RPPs', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());
  const auth = (user: User) => authHeader(t.app, user);

  function invite(inviter: User, eventId: string, body: object) {
    return http()
      .post(`/events/${eventId}/staff`)
      .set('Authorization', auth(inviter))
      .send(body);
  }

  function accept(user: User, staffId: string) {
    return http()
      .put(`/events/staff/${staffId}/accept`)
      .set('Authorization', auth(user));
  }

  function setQuota(
    user: User,
    eventId: string,
    staffId: string,
    body: object,
  ) {
    return http()
      .put(`/events/organizer/${eventId}/promoters/${staffId}/free-tickets`)
      .set('Authorization', auth(user))
      .send(body);
  }

  function send(
    user: User,
    eventId: string,
    ticketTypeId: string,
    quantity = 1,
  ) {
    return http()
      .post(`/events/organizer/${eventId}/free-tickets`)
      .set('Authorization', auth(user))
      .send({ ticketTypeId, quantity, email: 'invitado@neopass.test' });
  }

  function grants(user: User, eventId: string) {
    return http()
      .get(`/events/organizer/${eventId}/free-tickets`)
      .set('Authorization', auth(user));
  }

  const rppTerms = (freeTicketLimit?: number | null) => ({
    role: 'PROMOTER',
    commissionType: 'PERCENTAGE',
    commissionValue: 10,
    ...(freeTicketLimit !== undefined && { freeTicketLimit }),
  });

  // Evento con un RPP que aceptó la invitación, con o sin QR free.
  async function promoterScenario(freeTicketLimit?: number) {
    const created = await createOrganizerWithEvent(t.prisma);
    const rpp = await createUser(t.prisma, { name: 'Rocío RPP' });
    const invited = await invite(created.organizer, created.event.id, {
      userId: rpp.id,
      ...rppTerms(freeTicketLimit),
    }).expect(201);
    const staffId = (invited.body as { id: string }).id;
    await accept(rpp, staffId).expect(200);
    return { ...created, rpp, staffId };
  }

  async function coOrganizer(
    owner: User,
    eventId: string,
    permissions: EventPermission[],
    user?: User,
  ) {
    const member = user ?? (await createUser(t.prisma));
    const invited = await invite(owner, eventId, {
      userId: member.id,
      role: 'MANAGER',
      permissions,
    }).expect(201);
    await accept(member, (invited.body as { id: string }).id).expect(200);
    return member;
  }

  async function validTickets(eventId: string) {
    return t.prisma.ticket.count({
      where: { freeTicketGrant: { eventId }, status: 'VALID' },
    });
  }

  describe('habilitarlo al invitar', () => {
    it('la invitación dice cuántos QR free va a poder mandar y, al aceptarla, ya puede', async () => {
      const created = await createOrganizerWithEvent(t.prisma);
      const rpp = await createUser(t.prisma);

      const invited = await invite(created.organizer, created.event.id, {
        userId: rpp.id,
        ...rppTerms(10),
      }).expect(201);

      const notice = await t.prisma.notification.findFirstOrThrow({
        where: { userId: rpp.id, type: 'STAFF_INVITE' },
      });
      expect(notice.message).toContain('y hasta 10 QR free');
      const mine = (
        await http()
          .get('/events/staff/me')
          .set('Authorization', auth(rpp))
          .expect(200)
      ).body as MyStaffBody;
      expect(mine.invitations[0].freeTicketLimit).toBe(10);

      await accept(rpp, (invited.body as { id: string }).id).expect(200);
      await send(rpp, created.event.id, created.ticketType.id, 3).expect(201);
    });

    it('un RPP sin QR free no puede mandar', async () => {
      const s = await promoterScenario();

      const res = await send(s.rpp, s.event.id, s.ticketType.id).expect(403);

      expect((res.body as { message: string }).message).toBe(NO_PERMISSION);
    });

    it('con la invitación pendiente o rechazada todavía no puede mandar', async () => {
      const created = await createOrganizerWithEvent(t.prisma);
      const pending = await createUser(t.prisma);
      const rejecting = await createUser(t.prisma);
      await invite(created.organizer, created.event.id, {
        userId: pending.id,
        ...rppTerms(10),
      }).expect(201);
      const toReject = await invite(created.organizer, created.event.id, {
        userId: rejecting.id,
        ...rppTerms(10),
      }).expect(201);
      await http()
        .put(`/events/staff/${(toReject.body as { id: string }).id}/reject`)
        .set('Authorization', auth(rejecting))
        .expect(200);

      await send(pending, created.event.id, created.ticketType.id).expect(404);
      await send(rejecting, created.event.id, created.ticketType.id).expect(
        404,
      );
    });

    it('un co-organizador con permiso de staff invita RPPs, pero no les puede dar QR free', async () => {
      const created = await createOrganizerWithEvent(t.prisma);
      const manager = await coOrganizer(created.organizer, created.event.id, [
        'VIEW_SALES',
        'MANAGE_STAFF',
      ]);
      const rpp = await createUser(t.prisma);

      const res = await invite(manager, created.event.id, {
        userId: rpp.id,
        ...rppTerms(10),
      }).expect(403);

      expect((res.body as { message: string }).message).toBe(OWNER_ONLY);
      await invite(manager, created.event.id, {
        userId: rpp.id,
        ...rppTerms(),
      }).expect(201);
    });

    it.each([
      ['0', 0],
      ['negativo', -1],
      ['con decimales', 2.5],
      ['escrito como texto', 'diez'],
    ])('rechaza un tope %s', async (_, freeTicketLimit) => {
      const created = await createOrganizerWithEvent(t.prisma);
      const rpp = await createUser(t.prisma);

      await invite(created.organizer, created.event.id, {
        userId: rpp.id,
        ...rppTerms(),
        freeTicketLimit,
      }).expect(400);
    });
  });

  describe('mandar QR free', () => {
    it('manda hasta su tope: el envío que se pasa se rechaza sin crear nada', async () => {
      const s = await promoterScenario(5);

      await send(s.rpp, s.event.id, s.ticketType.id, 3).expect(201);
      const over = await send(s.rpp, s.event.id, s.ticketType.id, 3).expect(
        409,
      );
      expect((over.body as { message: string }).message).toBe(
        'Te quedan 2 QR free para mandar en este evento (tu tope es 5)',
      );
      await send(s.rpp, s.event.id, s.ticketType.id, 2).expect(201);
      await send(s.rpp, s.event.id, s.ticketType.id, 1).expect(409);

      expect(await validTickets(s.event.id)).toBe(5);
    });

    it('dos envíos al mismo tiempo no pasan juntos el tope', async () => {
      const s = await promoterScenario(5);

      const results = await Promise.all([
        send(s.rpp, s.event.id, s.ticketType.id, 3),
        send(s.rpp, s.event.id, s.ticketType.id, 3),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(await validTickets(s.event.id)).toBe(3);
    });

    it('ve, anula y reenvía solo sus envíos; el dueño ve todos', async () => {
      const s = await promoterScenario(5);
      const ownerGrant = await send(
        s.organizer,
        s.event.id,
        s.ticketType.id,
      ).expect(201);
      const rppGrant = await send(s.rpp, s.event.id, s.ticketType.id).expect(
        201,
      );
      const ownerGrantId = (ownerGrant.body as { id: string }).id;
      const rppGrantId = (rppGrant.body as { id: string }).id;

      const mine = (await grants(s.rpp, s.event.id).expect(200)).body as {
        id: string;
      }[];
      expect(mine.map((grant) => grant.id)).toEqual([rppGrantId]);
      await http()
        .post(
          `/events/organizer/${s.event.id}/free-tickets/${ownerGrantId}/cancel`,
        )
        .set('Authorization', auth(s.rpp))
        .expect(404);
      const all = (await grants(s.organizer, s.event.id).expect(200))
        .body as unknown[];
      expect(all).toHaveLength(2);

      await http()
        .post(
          `/events/organizer/${s.event.id}/free-tickets/${rppGrantId}/cancel`,
        )
        .set('Authorization', auth(s.rpp))
        .expect(201);
    });

    it('si además es co-organizador con QR free, rige su permiso de co-organizador', async () => {
      const s = await promoterScenario(2);
      await coOrganizer(s.organizer, s.event.id, ['SEND_FREE_TICKETS'], s.rpp);

      await send(s.rpp, s.event.id, s.ticketType.id, 5).expect(201);
    });

    it('con el evento terminado no puede mandar', async () => {
      const s = await promoterScenario(5);
      await t.prisma.event.update({
        where: { id: s.event.id },
        data: { status: 'FINISHED' },
      });

      await send(s.rpp, s.event.id, s.ticketType.id).expect(409);
    });

    it('sus QR free no le suman ventas ni comisión', async () => {
      const s = await promoterScenario(5);

      await send(s.rpp, s.event.id, s.ticketType.id, 3).expect(201);

      const staff = await t.prisma.eventStaff.findUniqueOrThrow({
        where: { id: s.staffId },
      });
      expect(staff.totalEarned.toString()).toBe('0');
      expect(await t.prisma.order.count()).toBe(0);
    });
  });

  describe('cambiar el tope', () => {
    it('el dueño lo baja, lo quita y lo vuelve a dar: lo mandado sigue valiendo', async () => {
      const s = await promoterScenario(5);
      await send(s.rpp, s.event.id, s.ticketType.id, 4).expect(201);

      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: 2,
      }).expect(200);
      const blocked = await send(s.rpp, s.event.id, s.ticketType.id).expect(
        409,
      );
      expect((blocked.body as { message: string }).message).toBe(
        'Ya llegaste a tu tope de 2 QR free en este evento',
      );

      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: null,
      }).expect(200);
      await send(s.rpp, s.event.id, s.ticketType.id).expect(403);
      expect(await validTickets(s.event.id)).toBe(4);

      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: 10,
      }).expect(200);
      await send(s.rpp, s.event.id, s.ticketType.id).expect(201);
    });

    it('al RPP que ya aceptó le llega una notificación con el cambio', async () => {
      const s = await promoterScenario(5);

      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: 8,
      }).expect(200);
      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: null,
      }).expect(200);

      const notices = await t.prisma.notification.findMany({
        where: { userId: s.rpp.id, type: 'SYSTEM' },
        orderBy: { createdAt: 'asc' },
      });
      expect(notices.map((notice) => notice.message)).toEqual([
        `Ahora podés mandar hasta 8 QR free en "${s.event.title}".`,
        `Ya no podés mandar QR free en "${s.event.title}".`,
      ]);
      expect(notices[0].actionUrl).toBe(`/panel/rpp/${s.event.id}`);
    });

    it('solo el dueño lo cambia: un co-organizador con permiso de staff no', async () => {
      const s = await promoterScenario(5);
      const manager = await coOrganizer(s.organizer, s.event.id, [
        'VIEW_SALES',
        'MANAGE_STAFF',
      ]);

      await setQuota(manager, s.event.id, s.staffId, {
        freeTicketLimit: 50,
      }).expect(403);
      await setQuota(s.rpp, s.event.id, s.staffId, {
        freeTicketLimit: 50,
      }).expect(404);
    });

    it.each([
      ['sin el campo', {}],
      ['en 0', { freeTicketLimit: 0 }],
      ['con decimales', { freeTicketLimit: 1.5 }],
      ['escrito como texto', { freeTicketLimit: 'diez' }],
    ])('rechaza un tope %s', async (_, body) => {
      const s = await promoterScenario(5);

      await setQuota(s.organizer, s.event.id, s.staffId, body).expect(400);
    });

    it('no cambia el de alguien que no es RPP del evento ni en un evento terminado', async () => {
      const s = await promoterScenario(5);
      const scanner = await createUser(t.prisma);
      const invited = await invite(s.organizer, s.event.id, {
        userId: scanner.id,
        role: 'SCANNER',
      }).expect(201);

      await setQuota(
        s.organizer,
        s.event.id,
        (invited.body as { id: string }).id,
        {
          freeTicketLimit: 5,
        },
      ).expect(404);

      await t.prisma.event.update({
        where: { id: s.event.id },
        data: { status: 'FINISHED' },
      });
      await setQuota(s.organizer, s.event.id, s.staffId, {
        freeTicketLimit: 8,
      }).expect(409);
    });
  });

  describe('lo que ve cada uno', () => {
    it('el dueño y el RPP ven cuántos QR free mandó y su tope; sin permiso, nada', async () => {
      const s = await promoterScenario(5);
      const other = await createUser(t.prisma);
      const otherInvite = await invite(s.organizer, s.event.id, {
        userId: other.id,
        ...rppTerms(),
      }).expect(201);
      await accept(other, (otherInvite.body as { id: string }).id).expect(200);
      await send(s.rpp, s.event.id, s.ticketType.id, 3).expect(201);

      const overview = (
        await http()
          .get('/events/organizer/staff/overview')
          .set('Authorization', auth(s.organizer))
          .expect(200)
      ).body as OverviewBody;
      const promoters = overview.events[0].promoters;
      expect(promoters.find((p) => p.id === s.staffId)?.freeTickets).toEqual({
        limit: 5,
        sent: 3,
      });
      expect(
        promoters.find((p) => p.id === (otherInvite.body as { id: string }).id)
          ?.freeTickets,
      ).toBeNull();

      const mine = (
        await http()
          .get('/events/staff/me')
          .set('Authorization', auth(s.rpp))
          .expect(200)
      ).body as MyStaffBody;
      expect(mine.events[0].promoter?.freeTickets).toEqual({
        limit: 5,
        sent: 3,
      });
    });
  });
});
