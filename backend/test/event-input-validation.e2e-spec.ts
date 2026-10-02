import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// La cuenta de Cloudinary de NeoPass en los tests sale de CLOUDINARY_URL
// (test/setup/test-env.ts).
const OWN_FLYER =
  'https://res.cloudinary.com/test-cloud/image/upload/flyer.jpg';

type Organizer = Parameters<typeof authHeader>[1];

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * DAY_MS);
  return {
    title: 'Evento nuevo',
    description: 'Descripción',
    imageUrl: OWN_FLYER,
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 6 * HOUR_MS).toISOString(),
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

describe('Datos del evento validados en el servidor', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function create(organizer: Organizer, overrides: Record<string, unknown>) {
    return request(t.app.getHttpServer())
      .post('/events')
      .set('Authorization', authHeader(t.app, organizer))
      .send(eventBody(overrides));
  }

  function edit(
    organizer: Organizer,
    eventId: string,
    changes: Record<string, unknown>,
  ) {
    return request(t.app.getHttpServer())
      .put(`/events/${eventId}`)
      .set('Authorization', authHeader(t.app, organizer))
      .send(changes);
  }

  const messageOf = (res: request.Response) =>
    ([] as string[]).concat(
      (res.body as { message: string | string[] }).message,
    );

  async function expectRejected(
    overrides: Record<string, unknown>,
    message: string,
  ) {
    const { organizer } = await createOrganizerWithEvent(t.prisma);

    const res = await create(organizer, overrides).expect(400);

    expect(messageOf(res)).toContain(message);
    expect(await t.prisma.event.count()).toBe(1);
  }

  describe('el flyer', () => {
    const FLYER_MESSAGE = 'Subí el flyer desde NeoPass';

    it('acepta una imagen subida a la cuenta de NeoPass', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await create(organizer, { imageUrl: OWN_FLYER }).expect(201);
    });

    it.each([
      ['de otro sitio', 'https://mi-servidor.com/flyer.jpg'],
      [
        'de otra cuenta de Cloudinary',
        'https://res.cloudinary.com/otra-cuenta/image/upload/flyer.jpg',
      ],
      [
        'que sale de la cuenta con ".."',
        'https://res.cloudinary.com/test-cloud/../otra-cuenta/image/upload/f.jpg',
      ],
      [
        'sin https',
        'http://res.cloudinary.com/test-cloud/image/upload/flyer.jpg',
      ],
      ['que no es un link', 'javascript:alert(1)'],
    ])('rechaza una imagen %s', async (_case, imageUrl) => {
      await expectRejected({ imageUrl }, FLYER_MESSAGE);
    });

    it('al editar tampoco acepta una imagen de otro sitio', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await edit(organizer, event.id, {
        imageUrl: 'https://mi-servidor.com/flyer.jpg',
      }).expect(400);

      const saved = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(saved.imageUrl).toBe(event.imageUrl);
    });
  });

  describe('el link de YouTube', () => {
    const YOUTUBE_MESSAGE = 'El link tiene que ser de un video de YouTube';

    it.each([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    ])('acepta %s', async (youtubeLink) => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await create(organizer, { youtubeLink }).expect(201);
    });

    it.each([
      ['de otro sitio', 'https://vimeo.com/123456'],
      ['que no es un link', 'mi video'],
    ])('rechaza un link %s', async (_case, youtubeLink) => {
      await expectRejected({ youtubeLink }, YOUTUBE_MESSAGE);
    });

    it('vacío quita el video', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);
      await t.prisma.event.update({
        where: { id: event.id },
        data: { youtubeLink: 'https://youtu.be/dQw4w9WgXcQ' },
      });

      await edit(organizer, event.id, { youtubeLink: null }).expect(200);

      const saved = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(saved.youtubeLink).toBeNull();
    });
  });

  describe('los largos', () => {
    it('acepta cada texto en su largo máximo', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await create(organizer, {
        title: 'a'.repeat(60),
        description: 'a'.repeat(2000),
        venueName: 'a'.repeat(60),
        venueAddress: 'a'.repeat(120),
        batches: batchesWith(
          { name: 'a'.repeat(30) },
          { name: 'a'.repeat(30) },
        ),
      }).expect(201);
    });

    it.each([
      [
        'un título',
        { title: 'a'.repeat(61) },
        'El título puede tener hasta 60 caracteres',
      ],
      [
        'una descripción',
        { description: 'a'.repeat(2001) },
        'La descripción puede tener hasta 2000 caracteres',
      ],
      [
        'un nombre de lugar',
        { venueName: 'a'.repeat(61) },
        'El nombre del lugar puede tener hasta 60 caracteres',
      ],
      [
        'una dirección',
        { venueAddress: 'a'.repeat(121) },
        'La dirección puede tener hasta 120 caracteres',
      ],
      [
        'un nombre de tanda',
        { batches: batchesWith({}, { name: 'a'.repeat(31) }) },
        'El nombre de la tanda puede tener hasta 30 caracteres',
      ],
      [
        'un nombre de entrada',
        { batches: batchesWith({ name: 'a'.repeat(31) }) },
        'El nombre de la entrada puede tener hasta 30 caracteres',
      ],
    ])('rechaza %s demasiado largo', async (_case, overrides, message) => {
      await expectRejected(overrides, message);
    });
  });

  describe('el stock', () => {
    it('acepta hasta 100.000 entradas por tipo', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await create(organizer, {
        batches: batchesWith({ stock: 100_000 }),
      }).expect(201);
    });

    it('rechaza más de 100.000 entradas por tipo', async () => {
      await expectRejected(
        { batches: batchesWith({ stock: 100_001 }) },
        'El stock máximo es 100.000',
      );
    });

    it('un número gigante responde un mensaje claro, no un error del servidor', async () => {
      await expectRejected(
        { batches: batchesWith({ stock: 3_000_000_000 }) },
        'El stock máximo es 100.000',
      );
    });
  });

  describe('campos obligatorios vaciados al editar', () => {
    it.each([
      'title',
      'description',
      'imageUrl',
      'startDate',
      'endDate',
      'venueName',
      'venueAddress',
      'status',
    ])('rechaza %s en null y no cambia nada', async (field) => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await edit(organizer, event.id, { [field]: null }).expect(400);

      const saved = await t.prisma.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      expect(saved).toEqual(event);
    });
  });

  describe('caracteres no válidos', () => {
    it('rechaza un texto con un carácter nulo con un mensaje claro', async () => {
      await expectRejected(
        { title: 'Fiesta\u0000' },
        'El texto tiene caracteres no válidos',
      );
    });

    it('lo rechaza también dentro de una tanda', async () => {
      await expectRejected(
        { batches: batchesWith({ name: 'Gene\u0000ral' }) },
        'El texto tiene caracteres no válidos',
      );
    });
  });
});
