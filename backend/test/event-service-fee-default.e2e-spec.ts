import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type Organizer = Parameters<typeof authHeader>[1];

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * DAY_MS);
  return {
    title: 'Evento nuevo',
    description: 'Descripción',
    imageUrl: 'https://res.cloudinary.com/test-cloud/image/upload/flyer.jpg',
    startDate: start.toISOString(),
    endDate: new Date(start.getTime() + 6 * HOUR_MS).toISOString(),
    venueName: 'Club',
    venueAddress: 'Av. Corrientes 1234',
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

describe('Cargo de servicio por defecto de un evento nuevo', () => {
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

  async function savedFee(eventId: string) {
    const event = await t.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    return event.neoPassFeePercentage.toString();
  }

  it('un evento creado por el organizador arranca con un cargo del 12 %', async () => {
    const { organizer } = await createOrganizerWithEvent(t.prisma);

    const res = await create(organizer, {}).expect(201);

    expect(await savedFee((res.body as { id: string }).id)).toBe('12');
  });

  it('el organizador no puede elegir su propio cargo al crear el evento', async () => {
    const { organizer } = await createOrganizerWithEvent(t.prisma);

    const res = await create(organizer, { neoPassFeePercentage: 0 }).expect(
      201,
    );

    expect(await savedFee((res.body as { id: string }).id)).toBe('12');
  });
});
