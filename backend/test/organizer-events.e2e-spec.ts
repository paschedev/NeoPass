import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const DAY_MS = 24 * 60 * 60 * 1000;

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * DAY_MS);
  return {
    title: 'Evento nuevo',
    description: 'Descripción',
    imageUrl: 'https://res.cloudinary.com/neopass/image/upload/flyer.jpg',
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 6 * 3600 * 1000).toISOString(),
    venueName: 'Club',
    venueAddress: 'Calle 123',
    status: 'PUBLISHED',
    batches: [
      {
        name: 'Preventa',
        status: 'PUBLISHED',
        ticketTypes: [{ name: 'General', price: 1000, stock: 100 }],
      },
    ],
    ...overrides,
  };
}

describe('Eventos del organizador', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  describe('ver un evento para editarlo', () => {
    it('el organizador ve su evento en borrador con sus tandas', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'DRAFT' },
      });

      const res = await request(t.app.getHttpServer())
        .get(`/events/organizer/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);

      const body = res.body as {
        id: string;
        ticketBatches: { ticketTypes: unknown[] }[];
      };
      expect(body.id).toBe(event.id);
      expect(body.ticketBatches[0].ticketTypes).toHaveLength(1);
    });

    it('otro organizador no puede verlo', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const intruder = await createUser(t.prisma, { role: 'ORGANIZER' });

      await request(t.app.getHttpServer())
        .get(`/events/organizer/${event.id}`)
        .set('Authorization', authHeader(t.app, intruder))
        .expect(403);
    });

    it('un evento que no existe da 404', async () => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      await request(t.app.getHttpServer())
        .get(`/events/organizer/${randomUUID()}`)
        .set('Authorization', authHeader(t.app, organizer))
        .expect(404);
    });
  });

  describe('crear', () => {
    async function organizerWithMp() {
      return createUser(t.prisma, {
        role: 'ORGANIZER',
        mercadoPagoAccessToken: 'TEST-organizer-access-token',
      });
    }

    function create(
      organizer: Parameters<typeof authHeader>[1],
      body: Record<string, unknown>,
    ) {
      return request(t.app.getHttpServer())
        .post('/events')
        .set('Authorization', authHeader(t.app, organizer))
        .send(body);
    }

    it('crea el evento con sus tandas y entradas', async () => {
      const organizer = await organizerWithMp();

      await create(organizer, eventBody()).expect(201);

      const event = await t.prisma.event.findFirstOrThrow({
        where: { organizerId: organizer.id },
        include: { ticketBatches: { include: { ticketTypes: true } } },
      });
      expect(event.ticketBatches[0].ticketTypes[0].stock).toBe(100);
    });

    it('un evento no puede terminar antes de empezar', async () => {
      const organizer = await organizerWithMp();
      const start = new Date(Date.now() + 30 * DAY_MS);

      await create(
        organizer,
        eventBody({
          startDate: start.toISOString(),
          endDate: new Date(start.getTime() - 3600 * 1000).toISOString(),
        }),
      ).expect(400);

      expect(await t.prisma.event.count()).toBe(0);
    });

    it('un evento nuevo no puede empezar en el pasado', async () => {
      const organizer = await organizerWithMp();

      await create(
        organizer,
        eventBody({
          startDate: new Date(Date.now() - DAY_MS).toISOString(),
          endDate: new Date(Date.now() + DAY_MS).toISOString(),
        }),
      ).expect(400);

      expect(await t.prisma.event.count()).toBe(0);
    });

    it('si fallan las tandas, el evento no queda creado a medias', async () => {
      const organizer = await organizerWithMp();

      const res = await create(
        organizer,
        eventBody({
          batches: [
            {
              name: 'Preventa',
              status: 'PUBLISHED',
              // Excede la precisión de la columna: la base rechaza la entrada.
              ticketTypes: [
                { name: 'General', price: 999_999_999_999, stock: 1 },
              ],
            },
          ],
        }),
      );

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(await t.prisma.event.count()).toBe(0);
    });
  });

  describe('editar', () => {
    it('el fin no puede quedar antes del inicio', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await request(t.app.getHttpServer())
        .put(`/events/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send({
          endDate: new Date(event.startDate.getTime() - 3600 * 1000),
        })
        .expect(400);

      const saved = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(saved.endDate).toEqual(event.endDate);
    });

    it('un evento finalizado no se puede editar', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { status: 'FINISHED' },
      });

      await request(t.app.getHttpServer())
        .put(`/events/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send({ title: 'Otro título' })
        .expect(409);
    });
  });
});
