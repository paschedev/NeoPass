import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { authHeader } from './utils/auth';
import {
  createBatch,
  createOrganizerWithEvent,
  createUser,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const DAY_MS = 24 * 60 * 60 * 1000;

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * DAY_MS);
  return {
    title: 'Evento nuevo',
    description: 'Descripción',
    imageUrl: 'https://res.cloudinary.com/test-cloud/image/upload/flyer.jpg',
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 6 * 3600 * 1000).toISOString(),
    venueName: 'Club',
    venueAddress: 'Calle 123',
    status: 'PUBLISHED',
    batches: [
      {
        name: 'Preventa',
        isVisible: true,
        ticketTypes: [{ name: 'General', price: 1000, stock: 100 }],
      },
    ],
    ...overrides,
  };
}

// Una tanda con una entrada, cambiando solo lo que el caso necesita.
function batchesWith(
  ticketType: Record<string, unknown> = {},
  batch: Record<string, unknown> = {},
) {
  return [
    {
      name: 'Preventa',
      isVisible: true,
      ...batch,
      ticketTypes: [
        { name: 'General', price: 1000, stock: 100, ...ticketType },
      ],
    },
  ];
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

    it('las tandas se ven en el orden en que se crearon, aunque después se hayan editado', async () => {
      const { organizer, event, batch } = await createOrganizerWithEvent(
        t.prisma,
      );
      const older = await createBatch(t.prisma, {
        eventId: event.id,
        name: 'Anticipada',
      });
      await t.prisma.ticketBatch.update({
        where: { id: older.batch.id },
        data: { createdAt: new Date(batch.createdAt.getTime() - DAY_MS) },
      });

      const get = (path: string) =>
        request(t.app.getHttpServer())
          .get(path)
          .set('Authorization', authHeader(t.app, organizer))
          .expect(200);
      type WithBatches = { ticketBatches: { name: string }[] };
      const names = (found: WithBatches) =>
        found.ticketBatches.map(({ name }) => name);

      const detail = await get(`/events/organizer/${event.id}`);
      const list = await get('/events/organizer/me');

      expect(names(detail.body as WithBatches)).toEqual([
        'Anticipada',
        'Preventa',
      ]);
      expect(names((list.body as WithBatches[])[0])).toEqual([
        'Anticipada',
        'Preventa',
      ]);
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

    it('con el token de Mercado Pago vencido no puede crear eventos', async () => {
      const organizer = await createUser(t.prisma, {
        role: 'ORGANIZER',
        mercadoPagoAccessToken: 'TEST-organizer-access-token',
        mercadoPagoTokenExpiresAt: new Date(Date.now() - 60_000),
      });

      const res = await create(organizer, eventBody()).expect(400);

      expect((res.body as { message: string }).message).toBe(
        'Vinculá Mercado Pago antes de crear un evento',
      );
      expect(await t.prisma.event.count()).toBe(0);
    });

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

    it('si la base rechaza una entrada, el evento no queda creado a medias', async () => {
      const organizer = await organizerWithMp();
      // Falla a mitad de la transacción: la primera entrada ya se guardó.
      await t.prisma.$executeRaw`
        ALTER TABLE "TicketType"
        ADD CONSTRAINT "test_rejected_name" CHECK (name <> 'Rechazada')`;

      try {
        await create(
          organizer,
          eventBody({
            batches: [
              {
                name: 'Preventa',
                isVisible: true,
                ticketTypes: [
                  { name: 'General', price: 1000, stock: 1 },
                  { name: 'Rechazada', price: 1000, stock: 1 },
                ],
              },
            ],
          }),
        ).expect(500);
      } finally {
        await t.prisma.$executeRaw`
          ALTER TABLE "TicketType" DROP CONSTRAINT "test_rejected_name"`;
      }

      expect(await t.prisma.event.count()).toBe(0);
      expect(await t.prisma.ticketBatch.count()).toBe(0);
    });

    it.each([
      [
        'una entrada de más de $99.999.999,99',
        batchesWith({ price: 100_000_000 }),
        'El precio máximo es $99.999.999,99',
      ],
      [
        'una entrada con precio negativo',
        batchesWith({ price: -1 }),
        'El precio no puede ser negativo',
      ],
      [
        'una entrada con stock 0',
        batchesWith({ stock: 0 }),
        'El stock tiene que ser mayor a 0',
      ],
      [
        'una entrada sin nombre',
        batchesWith({ name: '' }),
        'El nombre de la entrada es obligatorio',
      ],
      [
        'una entrada con el nombre en blanco',
        batchesWith({ name: '   ' }),
        'El nombre de la entrada es obligatorio',
      ],
      [
        'una tanda sin nombre',
        batchesWith({}, { name: '' }),
        'El nombre de la tanda es obligatorio',
      ],
      [
        'una tanda con el nombre en blanco',
        batchesWith({}, { name: '   ' }),
        'El nombre de la tanda es obligatorio',
      ],
    ])(
      'no se crea con %s, y el error lo explica',
      async (_case, batches, message) => {
        const organizer = await organizerWithMp();

        const res = await create(organizer, eventBody({ batches })).expect(400);

        expect((res.body as { message: string[] }).message).toEqual([
          expect.stringContaining(message),
        ]);
        expect(await t.prisma.event.count()).toBe(0);
      },
    );

    it.each([
      ['sin título', { title: '' }, 'El título es obligatorio'],
      [
        'sin descripción',
        { description: '   ' },
        'La descripción es obligatoria',
      ],
      ['sin flyer', { imageUrl: '' }, 'El flyer del evento es obligatorio'],
      ['sin lugar', { venueName: '   ' }, 'El nombre del lugar es obligatorio'],
      ['sin dirección', { venueAddress: '' }, 'La dirección es obligatoria'],
    ])('no se crea %s', async (_case, blank, message) => {
      const organizer = await organizerWithMp();

      const res = await create(organizer, eventBody(blank)).expect(400);

      expect((res.body as { message: string[] }).message).toEqual([message]);
      expect(await t.prisma.event.count()).toBe(0);
    });

    it('los textos se guardan sin espacios al principio ni al final', async () => {
      const organizer = await organizerWithMp();

      await create(
        organizer,
        eventBody({
          title: '  Fiesta  ',
          venueName: ' Club ',
          batches: batchesWith({ name: ' General ' }, { name: ' Preventa ' }),
        }),
      ).expect(201);

      const event = await t.prisma.event.findFirstOrThrow({
        include: { ticketBatches: { include: { ticketTypes: true } } },
      });
      expect(event.title).toBe('Fiesta');
      expect(event.venueName).toBe('Club');
      expect(event.ticketBatches[0].name).toBe('Preventa');
      expect(event.ticketBatches[0].ticketTypes[0].name).toBe('General');
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

    it.each(['', '/batches'])(
      'editar (PUT /events/:id%s) un evento que no existe da 404',
      async (path) => {
        const { organizer } = await createOrganizerWithEvent(t.prisma);

        await request(t.app.getHttpServer())
          .put(`/events/${randomUUID()}${path}`)
          .set('Authorization', authHeader(t.app, organizer))
          .send({ batches: [] })
          .expect(404);
      },
    );

    it.each([
      [
        '',
        'de más de $99.999.999,99',
        { price: 100_000_000 },
        'El precio máximo es $99.999.999,99',
      ],
      [
        '',
        'sin nombre',
        { name: '   ' },
        'El nombre de la entrada es obligatorio',
      ],
      [
        '/batches',
        'de más de $99.999.999,99',
        { price: 100_000_000 },
        'El precio máximo es $99.999.999,99',
      ],
      [
        '/batches',
        'sin nombre',
        { name: '   ' },
        'El nombre de la entrada es obligatorio',
      ],
    ])(
      'editar (PUT /events/:id%s) no guarda una entrada %s',
      async (path, _case, change, message) => {
        const { organizer, event, batch, ticketType } =
          await createOrganizerWithEvent(t.prisma);

        const res = await request(t.app.getHttpServer())
          .put(`/events/${event.id}${path}`)
          .set('Authorization', authHeader(t.app, organizer))
          .send({
            batches: batchesWith(
              { id: ticketType.id, ...change },
              { id: batch.id },
            ),
          })
          .expect(400);

        expect((res.body as { message: string[] }).message).toEqual([
          expect.stringContaining(message),
        ]);
        const saved = await t.prisma.ticketType.findUniqueOrThrow({
          where: { id: ticketType.id },
        });
        expect(saved.name).toBe('General');
        expect(Number(saved.price)).toBe(1000);
      },
    );

    it.each([
      ['el título', { title: '   ' }, 'El título es obligatorio'],
      ['la descripción', { description: '' }, 'La descripción es obligatoria'],
      ['el flyer', { imageUrl: '' }, 'El flyer del evento es obligatorio'],
      ['el lugar', { venueName: '   ' }, 'El nombre del lugar es obligatorio'],
      ['la dirección', { venueAddress: '' }, 'La dirección es obligatoria'],
    ])('no se puede dejar %s en blanco', async (_case, blank, message) => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      const res = await request(t.app.getHttpServer())
        .put(`/events/${event.id}`)
        .set('Authorization', authHeader(t.app, organizer))
        .send(blank)
        .expect(400);

      expect((res.body as { message: string[] }).message).toEqual([message]);
      const saved = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(saved).toEqual(event);
    });
  });
});
