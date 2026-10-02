import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Obelisco, Buenos Aires.
const LOCATION = {
  latitude: -34.6037389,
  longitude: -58.3815704,
  venueCity: 'Buenos Aires',
};
const NO_LOCATION = { latitude: null, longitude: null, venueCity: null };

type Organizer = Parameters<typeof authHeader>[1];

function eventBody(overrides: Record<string, unknown> = {}) {
  const start = new Date(Date.now() + 30 * DAY_MS);
  return {
    title: 'Evento nuevo',
    description: 'Descripción',
    imageUrl: 'https://res.cloudinary.com/neopass/image/upload/flyer.jpg',
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

describe('Ubicación del evento en el mapa', () => {
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

  async function publicLocation(eventId: string) {
    const res = await request(t.app.getHttpServer())
      .get(`/events/${eventId}`)
      .expect(200);
    const { latitude, longitude, venueCity } = res.body as typeof LOCATION;
    return { latitude, longitude, venueCity };
  }

  async function savedLocation(eventId: string) {
    const { latitude, longitude, venueCity } =
      await t.prisma.event.findUniqueOrThrow({ where: { id: eventId } });
    return { latitude, longitude, venueCity };
  }

  async function eventWithLocation() {
    const created = await createOrganizerWithEvent(t.prisma);
    await t.prisma.event.update({
      where: { id: created.event.id },
      data: LOCATION,
    });
    return created;
  }

  describe('al crear', () => {
    it('un evento con ubicación la muestra en su página pública', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      const res = await create(organizer, LOCATION).expect(201);

      const { id } = res.body as { id: string };
      expect(await publicLocation(id)).toEqual(LOCATION);
    });

    it('la ubicación es opcional: sin ella el evento se crea igual', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      const res = await create(organizer, {}).expect(201);

      const { id } = res.body as { id: string };
      expect(await publicLocation(id)).toEqual(NO_LOCATION);
    });

    it('la ciudad se guarda sin espacios al principio ni al final', async () => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      const res = await create(organizer, {
        ...LOCATION,
        venueCity: '  Rosario ',
      }).expect(201);

      const { id } = res.body as { id: string };
      expect((await savedLocation(id)).venueCity).toBe('Rosario');
    });

    it.each([
      ['latitud sin longitud', { latitude: -34.6 }],
      ['longitud sin latitud', { longitude: -58.38 }],
      ['latitud fuera del mapa', { latitude: 90.1, longitude: -58.38 }],
      ['longitud fuera del mapa', { latitude: -34.6, longitude: -180.1 }],
      [
        'coordenadas que no son números',
        { latitude: 'sur', longitude: 'oeste' },
      ],
      ['ciudad demasiado larga', { ...LOCATION, venueCity: 'a'.repeat(101) }],
    ])('rechaza %s y no crea el evento', async (_case, location) => {
      const { organizer } = await createOrganizerWithEvent(t.prisma);

      await create(organizer, location).expect(400);

      expect(await t.prisma.event.count()).toBe(1);
    });
  });

  describe('al editar antes de que empiece', () => {
    it('se puede agregar o cambiar la ubicación', async () => {
      const { organizer, event } = await createOrganizerWithEvent(t.prisma);

      await edit(organizer, event.id, LOCATION).expect(200);

      expect(await savedLocation(event.id)).toEqual(LOCATION);
    });

    it('se puede quitar la ubicación', async () => {
      const { organizer, event } = await eventWithLocation();

      await edit(organizer, event.id, NO_LOCATION).expect(200);

      expect(await savedLocation(event.id)).toEqual(NO_LOCATION);
    });

    it('cambiar otros datos sin mandar la ubicación la conserva', async () => {
      const { organizer, event } = await eventWithLocation();

      await edit(organizer, event.id, { title: 'Otro título' }).expect(200);

      expect(await savedLocation(event.id)).toEqual(LOCATION);
    });

    it.each([
      ['solo la latitud', { latitude: -31.4 }],
      ['quitar la latitud y dejar la longitud', { latitude: null }],
      [
        'una latitud con la longitud vacía',
        { latitude: -31.4, longitude: null },
      ],
    ])('rechaza %s y deja la ubicación como estaba', async (_case, changes) => {
      const { organizer, event } = await eventWithLocation();

      await edit(organizer, event.id, changes).expect(400);

      expect(await savedLocation(event.id)).toEqual(LOCATION);
    });
  });

  describe('con el evento en curso', () => {
    async function eventInProgress() {
      const created = await eventWithLocation();
      await t.prisma.event.update({
        where: { id: created.event.id },
        data: {
          startDate: new Date(Date.now() - HOUR_MS),
          endDate: new Date(Date.now() + 3 * HOUR_MS),
        },
      });
      return created;
    }

    it.each([
      ['moverla', { latitude: -31.4, longitude: -64.18 }],
      ['quitarla', NO_LOCATION],
      ['cambiar la ciudad', { venueCity: 'Córdoba' }],
    ])('no deja %s', async (_case, changes) => {
      const { organizer, event } = await eventInProgress();

      await edit(organizer, event.id, changes).expect(409);

      expect(await savedLocation(event.id)).toEqual(LOCATION);
    });

    it('acepta la ubicación si no cambia', async () => {
      const { organizer, event } = await eventInProgress();

      await edit(organizer, event.id, {
        title: 'Título nuevo',
        ...LOCATION,
      }).expect(200);
    });
  });
});
