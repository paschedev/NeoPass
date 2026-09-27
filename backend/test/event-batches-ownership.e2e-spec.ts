import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const EVENT_START = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

describe('Tandas y entradas: cada organizador toca solo las suyas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function twoOrganizers() {
    const mine = await createOrganizerWithEvent(t.prisma, { price: 1000 });
    const other = await createOrganizerWithEvent(t.prisma, { price: 5000 });
    return { mine, other };
  }

  function putBatches(
    user: Parameters<typeof authHeader>[1],
    eventId: string,
    batches: unknown[],
  ) {
    return request(t.app.getHttpServer())
      .put(`/events/${eventId}/batches`)
      .set('Authorization', authHeader(t.app, user))
      .send({ batches });
  }

  async function reload() {
    const batches = await t.prisma.ticketBatch.findMany();
    const ticketTypes = await t.prisma.ticketType.findMany();
    return { batches, ticketTypes };
  }

  it('un organizador puede editar sus tandas y entradas', async () => {
    const { mine } = await twoOrganizers();

    await putBatches(mine.organizer, mine.event.id, [
      {
        id: mine.batch.id,
        name: 'Preventa 2',
        status: 'PUBLISHED',
        ticketTypes: [
          { id: mine.ticketType.id, name: 'General', price: 2000, stock: 50 },
        ],
      },
    ]).expect(200);

    const ticketType = await t.prisma.ticketType.findUniqueOrThrow({
      where: { id: mine.ticketType.id },
    });
    expect(Number(ticketType.price)).toBe(2000);
    expect(ticketType.stock).toBe(50);
  });

  it('no puede editar las tandas de un evento ajeno', async () => {
    const { mine, other } = await twoOrganizers();
    const before = await reload();

    await putBatches(mine.organizer, other.event.id, [
      {
        id: other.batch.id,
        name: 'Tanda ajena',
        status: 'PUBLISHED',
        ticketTypes: [],
      },
    ]).expect(403);

    expect(await reload()).toEqual(before);
  });

  it('no puede modificar una tanda ajena metiéndola en su evento', async () => {
    const { mine, other } = await twoOrganizers();
    const before = await reload();

    await putBatches(mine.organizer, mine.event.id, [
      {
        id: other.batch.id,
        name: 'Tanda ajena',
        status: 'PUBLISHED',
        ticketTypes: [],
      },
    ]).expect(403);

    expect(await reload()).toEqual(before);
  });

  it('no puede modificar una entrada ajena metiéndola en su tanda', async () => {
    const { mine, other } = await twoOrganizers();
    const before = await reload();

    await putBatches(mine.organizer, mine.event.id, [
      {
        id: mine.batch.id,
        name: 'Preventa',
        status: 'PUBLISHED',
        ticketTypes: [
          { id: other.ticketType.id, name: 'Regalada', price: 1, stock: 999 },
        ],
      },
    ]).expect(403);

    expect(await reload()).toEqual(before);
  });

  it('al editar el evento no puede tocar tandas ajenas', async () => {
    const { mine, other } = await twoOrganizers();
    const before = await reload();

    await request(t.app.getHttpServer())
      .put(`/events/${mine.event.id}`)
      .set('Authorization', authHeader(t.app, mine.organizer))
      .send({
        title: 'Título nuevo',
        batches: [
          {
            id: other.batch.id,
            name: 'Tanda ajena',
            status: 'PUBLISHED',
            ticketTypes: [],
          },
        ],
      });

    expect(await reload()).toEqual(before);
  });

  it('al crear un evento no puede reutilizar tandas ajenas', async () => {
    const { mine, other } = await twoOrganizers();
    const before = await reload();

    await request(t.app.getHttpServer())
      .post('/events')
      .set('Authorization', authHeader(t.app, mine.organizer))
      .send({
        title: 'Evento nuevo',
        description: 'Descripción',
        imageUrl: 'https://res.cloudinary.com/neopass/image/upload/flyer.jpg',
        startDate: EVENT_START.toISOString(),
        endDate: new Date(
          EVENT_START.getTime() + 6 * 3600 * 1000,
        ).toISOString(),
        venueName: 'Club',
        venueAddress: 'Calle 123',
        status: 'DRAFT',
        batches: [
          {
            id: other.batch.id,
            name: 'Tanda ajena',
            status: 'PUBLISHED',
            ticketTypes: [
              {
                id: other.ticketType.id,
                name: 'Regalada',
                price: 1,
                stock: 999,
              },
            ],
          },
        ],
      })
      .expect(403);

    expect(await reload()).toEqual(before);
    expect(
      await t.prisma.event.count({ where: { organizerId: mine.organizer.id } }),
    ).toBe(1);
  });
});
