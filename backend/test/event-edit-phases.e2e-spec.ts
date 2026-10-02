import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createOrder,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

describe('Editar un evento según su momento', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function put(
    user: Parameters<typeof authHeader>[1],
    path: string,
    body: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .put(path)
      .set('Authorization', authHeader(t.app, user))
      .send(body);
  }

  function savedEvent(id: string) {
    return t.prisma.event.findUniqueOrThrow({ where: { id } });
  }

  // Empezó hace una hora y termina en tres.
  async function eventInProgress() {
    const created = await createOrganizerWithEvent(t.prisma);
    const now = Date.now();
    const event = await t.prisma.event.update({
      where: { id: created.event.id },
      data: {
        startDate: new Date(now - HOUR_MS),
        endDate: new Date(now + 3 * HOUR_MS),
        venueName: 'Club',
        venueAddress: 'Calle 123',
      },
    });
    return { ...created, event };
  }

  function batchesBody(
    batch: { id: string },
    ticketType: { id: string },
    stock: number,
  ) {
    return {
      batches: [
        {
          id: batch.id,
          name: 'Preventa',
          isVisible: true,
          ticketTypes: [
            { id: ticketType.id, name: 'General', price: 1000, stock },
          ],
        },
      ],
    };
  }

  describe('antes de que empiece', () => {
    it('guarda un inicio nuevo que sigue siendo futuro', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      const startDate = new Date(event.startDate.getTime() - DAY_MS);

      await put(organizer, `/events/${event.id}`, { startDate }).expect(200);

      expect((await savedEvent(event.id)).startDate).toEqual(startDate);
    });

    it('no deja mover el inicio al pasado y no guarda nada', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await put(organizer, `/events/${event.id}`, {
        title: 'Otro título',
        startDate: new Date(Date.now() - HOUR_MS),
      }).expect(400);

      const saved = await savedEvent(event.id);
      expect(saved.startDate).toEqual(event.startDate);
      expect(saved.title).toBe(event.title);
    });
  });

  describe('en curso', () => {
    it('guarda el título, la descripción y la imagen', async () => {
      const { organizer, event } = await eventInProgress();

      await put(organizer, `/events/${event.id}`, {
        title: 'Título nuevo',
        description: 'Descripción nueva',
        imageUrl:
          'https://res.cloudinary.com/test-cloud/image/upload/nueva.jpg',
      }).expect(200);

      const saved = await savedEvent(event.id);
      expect(saved.title).toBe('Título nuevo');
      expect(saved.description).toBe('Descripción nueva');
      expect(saved.imageUrl).toContain('nueva.jpg');
    });

    it('deja extender el fin', async () => {
      const { organizer, event } = await eventInProgress();
      const endDate = new Date(event.endDate.getTime() + 2 * HOUR_MS);

      await put(organizer, `/events/${event.id}`, { endDate }).expect(200);

      expect((await savedEvent(event.id)).endDate).toEqual(endDate);
    });

    it('no deja adelantar el fin', async () => {
      const { organizer, event } = await eventInProgress();

      await put(organizer, `/events/${event.id}`, {
        endDate: new Date(event.endDate.getTime() - HOUR_MS),
      }).expect(400);

      expect((await savedEvent(event.id)).endDate).toEqual(event.endDate);
    });

    it('no deja cambiar el inicio', async () => {
      const { organizer, event } = await eventInProgress();

      await put(organizer, `/events/${event.id}`, {
        startDate: new Date(event.startDate.getTime() + 30 * 60 * 1000),
      }).expect(409);

      expect((await savedEvent(event.id)).startDate).toEqual(event.startDate);
    });

    it('no deja cambiar el lugar', async () => {
      const { organizer, event } = await eventInProgress();

      await put(organizer, `/events/${event.id}`, {
        venueName: 'Otro club',
      }).expect(409);

      expect((await savedEvent(event.id)).venueName).toBe('Club');
    });

    it('acepta el inicio y el lugar si no cambian', async () => {
      const { organizer, event } = await eventInProgress();

      await put(organizer, `/events/${event.id}`, {
        title: 'Título nuevo',
        startDate: event.startDate.toISOString(),
        venueName: 'Club',
        venueAddress: 'Calle 123',
      }).expect(200);

      expect((await savedEvent(event.id)).title).toBe('Título nuevo');
    });

    it('no deja cambiar las tandas al editar el evento', async () => {
      const { organizer, event, batch, ticketType } = await eventInProgress();

      await put(
        organizer,
        `/events/${event.id}`,
        batchesBody(batch, ticketType, 200),
      ).expect(409);

      const saved = await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      });
      expect(saved.stock).toBe(100);
    });

    it('no deja cambiar las tandas por su propia ruta', async () => {
      const { organizer, event, batch, ticketType } = await eventInProgress();

      await put(
        organizer,
        `/events/${event.id}/batches`,
        batchesBody(batch, ticketType, 200),
      ).expect(409);

      const saved = await t.prisma.ticketType.findUniqueOrThrow({
        where: { id: ticketType.id },
      });
      expect(saved.stock).toBe(100);
    });
  });

  describe('terminado o cancelado', () => {
    it('no deja editar un evento cuyo fin ya pasó, aunque todavía no figure como finalizado', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: {
          startDate: new Date(Date.now() - 5 * HOUR_MS),
          endDate: new Date(Date.now() - 60 * 1000),
        },
      });

      await put(organizer, `/events/${event.id}`, {
        title: 'Otro título',
      }).expect(409);
    });

    it('no deja editar un evento cancelado', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'CANCELLED' },
      });

      await put(organizer, `/events/${event.id}`, {
        title: 'Otro título',
      }).expect(409);
    });

    it('no deja cambiar las tandas de un evento terminado', async () => {
      const { organizer, event, batch, ticketType } =
        await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'FINISHED' },
      });

      await put(
        organizer,
        `/events/${event.id}/batches`,
        batchesBody(batch, ticketType, 200),
      ).expect(409);
    });
  });

  describe('el estado', () => {
    it.each(['CANCELLED', 'FINISHED'])(
      'no deja marcarlo como %s desde la edición',
      async (status) => {
        const { organizer, event } = await createOrganizerWithEvent(t.prisma);

        await put(organizer, `/events/${event.id}`, { status }).expect(400);

        expect((await savedEvent(event.id)).status).toBe('PUBLISHED');
      },
    );

    it('publica un borrador', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'DRAFT' },
      });

      await put(organizer, `/events/${event.id}`, {
        status: 'PUBLISHED',
      }).expect(200);

      expect((await savedEvent(event.id)).status).toBe('PUBLISHED');
    });

    it('no deja volver a borrador un evento con entradas vendidas o reservadas', async () => {
      const { organizer, event, ticketType } = await createOrganizerWithEvent(
        t.prisma,
      );
      const buyer = await createUser(t.prisma);
      await createOrder(t.prisma, { user: buyer, ticketType });

      await put(organizer, `/events/${event.id}`, {
        status: 'DRAFT',
      }).expect(409);

      expect((await savedEvent(event.id)).status).toBe('PUBLISHED');
    });

    it('vuelve a borrador un evento sin ventas', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await put(organizer, `/events/${event.id}`, { status: 'DRAFT' }).expect(
        200,
      );

      expect((await savedEvent(event.id)).status).toBe('DRAFT');
    });

    it.each(['CANCELLED', 'FINISHED'])(
      'no deja crear un evento %s',
      async (status) => {
        const organizer = await createUser(t.prisma, {
          role: 'ORGANIZER',
          mercadoPagoAccessToken: 'TEST-organizer-access-token',
        });
        const start = new Date(Date.now() + 30 * DAY_MS);

        await request(t.app.getHttpServer())
          .post('/events')
          .set('Authorization', authHeader(t.app, organizer))
          .send({
            title: 'Evento nuevo',
            description: 'Descripción',
            imageUrl:
              'https://res.cloudinary.com/test-cloud/image/upload/f.jpg',
            startDate: start.toISOString(),
            endDate: new Date(start.getTime() + 6 * HOUR_MS).toISOString(),
            venueName: 'Club',
            venueAddress: 'Calle 123',
            status,
            batches: [],
          })
          .expect(400);

        expect(await t.prisma.event.count()).toBe(0);
      },
    );
  });
});
