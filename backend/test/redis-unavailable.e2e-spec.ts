import request from 'supertest';
import { EventsLifecycleService } from '../src/events/events-lifecycle.service';
import { EventsRepository } from '../src/events/repositories/events.repository';
import { MercadoPagoOAuthService } from '../src/payments/mercadopago-oauth.service';
import { authHeader } from './utils/auth';
import {
  createOrganizerWithEvent,
  createUser,
  mercadoPagoTokenCipher,
} from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const BUSY_MESSAGE =
  'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.';
const SEARCHES_PER_MINUTE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Si Redis no responde', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    // The connection closes and does not come back: every command fails.
    t.redis.disconnect();
  });

  beforeEach(() => resetDb(t.prisma));

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => t.close());

  it('la API responde y el límite sigue aplicando en cada réplica', async () => {
    const user = await createUser(t.prisma);
    const search = () =>
      request(t.app.getHttpServer())
        .get('/auth/users/search')
        .query({ q: 'alguien' })
        .set('Authorization', authHeader(t.app, user))
        .set('X-Forwarded-For', '181.47.0.1');
    for (let i = 0; i < SEARCHES_PER_MINUTE; i++) {
      await search().expect(200);
    }

    const res = await search().expect(429);

    expect((res.body as { message: string }).message).toBe(BUSY_MESSAGE);
  });

  it('el cierre de eventos terminados saltea el turno sin error', async () => {
    const finish = jest.spyOn(
      t.app.get(EventsRepository),
      'finishPublishedEventsEndedBefore',
    );

    await t.app.get(EventsLifecycleService).handleFinishedEvents();

    expect(finish).not.toHaveBeenCalled();
  });

  it('la renovación de tokens de Mercado Pago saltea el turno sin error', async () => {
    await createUser(t.prisma, {
      role: 'ORGANIZER',
      mercadoPagoAccessToken: mercadoPagoTokenCipher.encrypt(
        'APP_USR-current-token',
      ),
      mercadoPagoRefreshToken: mercadoPagoTokenCipher.encrypt('TG-old'),
      mercadoPagoTokenExpiresAt: new Date(Date.now() + 10 * DAY_MS),
    });

    await t.app.get(MercadoPagoOAuthService).handleTokenRenewal();

    expect(fetch).not.toHaveBeenCalled();
  });

  it('una visita por el link de un RRPP no suma click y la página del evento carga', async () => {
    const { event } = await createOrganizerWithEvent(t.prisma);
    const promoter = await createUser(t.prisma);
    const staff = await t.prisma.eventStaff.create({
      data: {
        eventId: event.id,
        userId: promoter.id,
        role: 'PROMOTER',
        status: 'ACCEPTED',
        commissionType: 'PERCENTAGE',
        commissionValue: 10,
      },
    });

    await request(t.app.getHttpServer())
      .get(`/events/${event.id}?rpp=${staff.id}`)
      .set('X-Forwarded-For', '181.47.0.2')
      .expect(200);

    const { clicks } = await t.prisma.eventStaff.findUniqueOrThrow({
      where: { id: staff.id },
    });
    expect(clicks).toBe(0);
  });
});
