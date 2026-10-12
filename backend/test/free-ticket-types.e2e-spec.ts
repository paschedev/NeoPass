import { User } from '@prisma/client';
import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const NO_TYPES = 'Elegí al menos un tipo de entrada para los QR free';
const UNKNOWN_TYPE = 'Elegí tipos de entrada del evento';
const notAllowed = (type: string) => `No podés mandar QR free de "${type}"`;

type Quota = { limit: number; sent: number; types: string[] } | null;

describe('Tipos de entrada que cada uno puede regalar como QR free', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());
  const auth = (user: User) => authHeader(t.app, user);

  const invite = (inviter: User, eventId: string, body: object) =>
    http()
      .post(`/events/${eventId}/staff`)
      .set('Authorization', auth(inviter))
      .send(body);

  const accept = (user: User, staffId: string) =>
    http()
      .put(`/events/staff/${staffId}/accept`)
      .set('Authorization', auth(user));

  const send = (user: User, eventId: string, ticketTypeId: string) =>
    http()
      .post(`/events/organizer/${eventId}/free-tickets`)
      .set('Authorization', auth(user))
      .send({ ticketTypeId, quantity: 1, email: 'invitado@neopass.test' });

  const grantAction = (
    user: User,
    eventId: string,
    grantId: string,
    action: 'cancel' | 'resend',
  ) =>
    http()
      .post(`/events/organizer/${eventId}/free-tickets/${grantId}/${action}`)
      .set('Authorization', auth(user));

  const setPromoterFreeTickets = (
    user: User,
    eventId: string,
    staffId: string,
    body: object,
  ) =>
    http()
      .put(`/events/organizer/${eventId}/promoters/${staffId}/free-tickets`)
      .set('Authorization', auth(user))
      .send(body);

  const setCoOrganizer = (
    user: User,
    eventId: string,
    staffId: string,
    body: object,
  ) =>
    http()
      .put(`/events/organizer/${eventId}/co-organizers/${staffId}`)
      .set('Authorization', auth(user))
      .send(body);

  const get = (user: User, path: string) =>
    http().get(path).set('Authorization', auth(user));

  const rppTerms = {
    role: 'PROMOTER',
    commissionType: 'PERCENTAGE',
    commissionValue: 10,
  };

  // Evento con dos tandas: Preventa (General y VIP) y Lote 1 (General).
  async function eventWithTypes() {
    const created = await createOrganizerWithEvent(t.prisma);
    const { event, batch, ticketType: general } = created;
    const vip = await t.prisma.ticketType.create({
      data: {
        eventId: event.id,
        batchId: batch.id,
        name: 'VIP',
        price: 5000,
        stock: 20,
      },
    });
    const { ticketType: laterGeneral } = await createBatch(t.prisma, {
      eventId: event.id,
      name: 'Lote 1',
    });
    return { ...created, owner: created.organizer, general, vip, laterGeneral };
  }

  // RPP que aceptó, con 10 QR free de los tipos dados.
  async function promoter(
    owner: User,
    eventId: string,
    freeTicketTypes: string[],
    user?: User,
  ) {
    const rpp = user ?? (await createUser(t.prisma, { name: 'Rocío RPP' }));
    const invited = await invite(owner, eventId, {
      userId: rpp.id,
      ...rppTerms,
      freeTicketLimit: 10,
      freeTicketTypes,
    }).expect(201);
    const staffId = (invited.body as { id: string }).id;
    await accept(rpp, staffId).expect(200);
    return { rpp, staffId };
  }

  // Co-organizador que aceptó, con permiso de QR free de los tipos dados.
  async function coOrganizer(
    owner: User,
    eventId: string,
    freeTicketTypes: string[],
    user?: User,
  ) {
    const member = user ?? (await createUser(t.prisma, { name: 'Ana Pérez' }));
    const invited = await invite(owner, eventId, {
      userId: member.id,
      role: 'MANAGER',
      permissions: ['SEND_FREE_TICKETS'],
      freeTicketTypes,
    }).expect(201);
    const staffId = (invited.body as { id: string }).id;
    await accept(member, staffId).expect(200);
    return { member, staffId };
  }

  const validFreeTickets = (eventId: string) =>
    t.prisma.ticket.count({
      where: { freeTicketGrant: { eventId }, status: 'VALID' },
    });

  const storedTypes = async (staffId: string) =>
    (
      await t.prisma.eventStaff.findUniqueOrThrow({
        where: { id: staffId },
        select: { freeTicketTypes: true },
      })
    ).freeTicketTypes;

  describe('al mandar', () => {
    it('un RPP con General la manda y no puede mandar VIP, sin gastar su tope', async () => {
      const s = await eventWithTypes();
      const { rpp } = await promoter(s.owner, s.event.id, ['General']);

      await send(rpp, s.event.id, s.general.id).expect(201);
      const res = await send(rpp, s.event.id, s.vip.id).expect(403);

      expect((res.body as { message: string }).message).toBe(notAllowed('VIP'));
      expect(await validFreeTickets(s.event.id)).toBe(1);
    });

    it('un co-organizador manda solo los tipos que tiene tildados', async () => {
      const s = await eventWithTypes();
      const { member, staffId } = await coOrganizer(s.owner, s.event.id, [
        'General',
      ]);

      await send(member, s.event.id, s.vip.id).expect(403);
      await setCoOrganizer(s.owner, s.event.id, staffId, {
        permissions: ['SEND_FREE_TICKETS'],
        freeTicketTypes: ['General', 'VIP'],
      }).expect(200);

      await send(member, s.event.id, s.vip.id).expect(201);
    });

    it('quien organiza el evento manda cualquier tipo sin tildar nada', async () => {
      const s = await eventWithTypes();

      await send(s.owner, s.event.id, s.vip.id).expect(201);
    });

    it('un tipo tildado vale en todas las tandas, sin importar mayúsculas ni espacios', async () => {
      const s = await eventWithTypes();
      const { rpp, staffId } = await promoter(s.owner, s.event.id, [
        '  general ',
        'GENERAL',
      ]);

      await send(rpp, s.event.id, s.general.id).expect(201);
      await send(rpp, s.event.id, s.laterGeneral.id).expect(201);
      // Se guarda una vez, como lo escribe el evento.
      expect(await storedTypes(staffId)).toEqual(['General']);
    });

    it('quien también es RPP del evento manda con su regla de co-organizador', async () => {
      const s = await eventWithTypes();
      const both = await createUser(t.prisma);
      await coOrganizer(s.owner, s.event.id, ['VIP'], both);
      await promoter(s.owner, s.event.id, ['General'], both);

      const res = await send(both, s.event.id, s.general.id).expect(403);
      expect((res.body as { message: string }).message).toBe(
        notAllowed('General'),
      );
      await send(both, s.event.id, s.vip.id).expect(201);
    });

    it('un tipo renombrado deja de estar permitido hasta que se lo vuelvan a tildar', async () => {
      const s = await eventWithTypes();
      const { rpp, staffId } = await promoter(s.owner, s.event.id, ['VIP']);
      await t.prisma.ticketType.update({
        where: { id: s.vip.id },
        data: { name: 'VIP Gold' },
      });

      const res = await send(rpp, s.event.id, s.vip.id).expect(403);
      expect((res.body as { message: string }).message).toBe(
        notAllowed('VIP Gold'),
      );

      await setPromoterFreeTickets(s.owner, s.event.id, staffId, {
        freeTicketLimit: 10,
        freeTicketTypes: ['VIP Gold'],
      }).expect(200);
      await send(rpp, s.event.id, s.vip.id).expect(201);
    });

    it('quitar un tipo no anula lo ya mandado: se puede reenviar y anular', async () => {
      const s = await eventWithTypes();
      const { rpp, staffId } = await promoter(s.owner, s.event.id, [
        'General',
        'VIP',
      ]);
      const sent = await send(rpp, s.event.id, s.vip.id).expect(201);
      const grantId = (sent.body as { id: string }).id;

      await setPromoterFreeTickets(s.owner, s.event.id, staffId, {
        freeTicketLimit: 10,
        freeTicketTypes: ['General'],
      }).expect(200);

      expect(await validFreeTickets(s.event.id)).toBe(1);
      await send(rpp, s.event.id, s.vip.id).expect(403);
      // Pasada la espera entre reenvíos.
      await t.prisma.freeTicketGrant.update({
        where: { id: grantId },
        data: { lastSentAt: new Date(Date.now() - HOUR_MS) },
      });
      await grantAction(rpp, s.event.id, grantId, 'resend').expect(201);
      await grantAction(rpp, s.event.id, grantId, 'cancel').expect(201);
      expect(await validFreeTickets(s.event.id)).toBe(0);
    });
  });

  describe('al habilitarlo', () => {
    it.each([
      ['sin tipos', undefined, NO_TYPES],
      ['con la lista vacía', [], NO_TYPES],
      ['con un tipo que el evento no tiene', ['General', 'Mesa'], UNKNOWN_TYPE],
    ])(
      'invitar a un RPP con QR free %s da error',
      async (_case, freeTicketTypes, message) => {
        const s = await eventWithTypes();
        const rpp = await createUser(t.prisma);

        const res = await invite(s.owner, s.event.id, {
          userId: rpp.id,
          ...rppTerms,
          freeTicketLimit: 10,
          ...(freeTicketTypes && { freeTicketTypes }),
        }).expect(400);

        expect(JSON.stringify(res.body)).toContain(message);
        expect(await t.prisma.eventStaff.count()).toBe(0);
      },
    );

    it('invitar a un co-organizador que manda QR free sin tipos da error', async () => {
      const s = await eventWithTypes();
      const member = await createUser(t.prisma);

      const res = await invite(s.owner, s.event.id, {
        userId: member.id,
        role: 'MANAGER',
        permissions: ['SEND_FREE_TICKETS'],
      }).expect(400);

      expect(JSON.stringify(res.body)).toContain(NO_TYPES);
    });

    it('cambiar los tipos a uno que el evento no tiene da error', async () => {
      const s = await eventWithTypes();
      const { staffId: rppId } = await promoter(s.owner, s.event.id, [
        'General',
      ]);
      const { staffId: coOrganizerId } = await coOrganizer(
        s.owner,
        s.event.id,
        ['General'],
      );

      const toPromoter = await setPromoterFreeTickets(
        s.owner,
        s.event.id,
        rppId,
        { freeTicketLimit: 10, freeTicketTypes: ['Mesa'] },
      ).expect(400);
      const toCoOrganizer = await setCoOrganizer(
        s.owner,
        s.event.id,
        coOrganizerId,
        { permissions: ['SEND_FREE_TICKETS'], freeTicketTypes: [] },
      ).expect(400);

      expect(JSON.stringify(toPromoter.body)).toContain(UNKNOWN_TYPE);
      expect(JSON.stringify(toCoOrganizer.body)).toContain(NO_TYPES);
      expect(await storedTypes(rppId)).toEqual(['General']);
      expect(await storedTypes(coOrganizerId)).toEqual(['General']);
    });

    it('sin QR free los tipos no se guardan', async () => {
      const s = await eventWithTypes();
      const rpp = await createUser(t.prisma);
      const member = await createUser(t.prisma);

      const promoterInvite = await invite(s.owner, s.event.id, {
        userId: rpp.id,
        ...rppTerms,
        freeTicketTypes: ['General'],
      }).expect(201);
      const coOrganizerInvite = await invite(s.owner, s.event.id, {
        userId: member.id,
        role: 'MANAGER',
        permissions: ['VIEW_SALES'],
        freeTicketTypes: ['General'],
      }).expect(201);

      expect(
        await storedTypes((promoterInvite.body as { id: string }).id),
      ).toEqual([]);
      expect(
        await storedTypes((coOrganizerInvite.body as { id: string }).id),
      ).toEqual([]);
    });

    it('quitarle los QR free a un RPP borra sus tipos', async () => {
      const s = await eventWithTypes();
      const { staffId } = await promoter(s.owner, s.event.id, ['General']);

      await setPromoterFreeTickets(s.owner, s.event.id, staffId, {
        freeTicketLimit: null,
        freeTicketTypes: ['General'],
      }).expect(200);

      expect(await storedTypes(staffId)).toEqual([]);
    });
  });

  describe('lo que ve cada uno', () => {
    it('la invitación, el aviso de cambio y el historial dicen los tipos', async () => {
      const s = await eventWithTypes();
      const { rpp, staffId } = await promoter(s.owner, s.event.id, [
        'General',
        'VIP',
      ]);
      await coOrganizer(s.owner, s.event.id, ['VIP']);
      await setPromoterFreeTickets(s.owner, s.event.id, staffId, {
        freeTicketLimit: 5,
        freeTicketTypes: ['General'],
      }).expect(200);

      const messages = (
        await t.prisma.notification.findMany({
          where: { userId: rpp.id },
          orderBy: { createdAt: 'asc' },
          select: { message: true },
        })
      ).map((notification) => notification.message);
      expect(messages).toEqual([
        `Te invitaron como promotor (RPP) al evento "${s.event.title}", con 10% de comisión por entrada y hasta 10 QR free de General y VIP.`,
        `Ahora podés mandar hasta 5 QR free de General en "${s.event.title}".`,
      ]);

      const history = (
        await t.prisma.eventActivity.findMany({
          where: { eventId: s.event.id },
          orderBy: { createdAt: 'asc' },
          select: { summary: true },
        })
      ).map((entry) => entry.summary);
      expect(history).toEqual([
        'Invitó a Rocío RPP como promotor (RPP), con 10% de comisión por entrada y hasta 10 QR free de General y VIP.',
        'Invitó a Ana Pérez a co-organizar. Va a poder escanear y mandar QR free de VIP.',
      ]);
    });

    it('el dueño ve los tipos de cada RPP y de cada co-organizador', async () => {
      const s = await eventWithTypes();
      const { staffId: rppId } = await promoter(s.owner, s.event.id, [
        'General',
      ]);
      await coOrganizer(s.owner, s.event.id, ['General', 'VIP']);

      const overview = await get(
        s.owner,
        '/events/organizer/staff/overview',
      ).expect(200);
      const coOrganizers = await get(
        s.owner,
        `/events/organizer/${s.event.id}/co-organizers`,
      ).expect(200);

      const { events } = overview.body as {
        events: { promoters: { id: string; freeTickets: Quota }[] }[];
      };
      expect(
        events[0].promoters.find((p) => p.id === rppId)?.freeTickets,
      ).toEqual({ limit: 10, sent: 0, types: ['General'] });
      expect(
        (coOrganizers.body as { freeTicketTypes: string[] }[])[0]
          .freeTicketTypes,
      ).toEqual(['General', 'VIP']);
    });

    it('el RPP ve sus tipos en Staff y su formulario trae solo esos', async () => {
      const s = await eventWithTypes();
      const { rpp } = await promoter(s.owner, s.event.id, ['General']);
      const pending = await createUser(t.prisma);
      await invite(s.owner, s.event.id, {
        userId: pending.id,
        ...rppTerms,
        freeTicketLimit: 3,
        freeTicketTypes: ['VIP'],
      }).expect(201);

      const myStaff = await get(rpp, '/events/staff/me').expect(200);
      const invitation = await get(pending, '/events/staff/me').expect(200);
      const stats = await get(
        rpp,
        `/events/promoter/me/${s.event.id}/stats`,
      ).expect(200);

      expect(
        (myStaff.body as { events: { promoter: { freeTickets: Quota } }[] })
          .events[0].promoter.freeTickets,
      ).toEqual({ limit: 10, sent: 0, types: ['General'] });
      expect(
        (invitation.body as { invitations: { freeTicketTypes: string[] }[] })
          .invitations[0].freeTicketTypes,
      ).toEqual(['VIP']);
      expect(
        (
          stats.body as {
            freeTickets: {
              ticketBatches: {
                name: string;
                ticketTypes: { id: string; name: string }[];
              }[];
            };
          }
        ).freeTickets.ticketBatches,
      ).toEqual([
        {
          name: 'Preventa',
          ticketTypes: [{ id: s.general.id, name: 'General' }],
        },
        {
          name: 'Lote 1',
          ticketTypes: [{ id: s.laterGeneral.id, name: 'General' }],
        },
      ]);
    });

    it('el detalle del evento dice qué tipos puede regalar quien lo mira', async () => {
      const s = await eventWithTypes();
      const { member } = await coOrganizer(s.owner, s.event.id, ['VIP']);

      const asCoOrganizer = await get(
        member,
        `/events/organizer/${s.event.id}`,
      ).expect(200);
      const asOwner = await get(
        s.owner,
        `/events/organizer/${s.event.id}`,
      ).expect(200);

      type Detail = { access: { freeTicketTypes: string[] | null } };
      expect((asCoOrganizer.body as Detail).access.freeTicketTypes).toEqual([
        'VIP',
      ]);
      // El dueño regala cualquiera.
      expect((asOwner.body as Detail).access.freeTicketTypes).toBeNull();
    });
  });
});
