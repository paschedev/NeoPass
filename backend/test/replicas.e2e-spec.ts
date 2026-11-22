import { randomUUID } from 'node:crypto';
import { User } from '@prisma/client';
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
const SCANS_PER_MINUTE = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const FIVE_MINUTES_MS = 5 * 60 * 1000;
// Lo que dura un token de Mercado Pago: 180 días, en segundos.
const TOKEN_TTL_S = 15_552_000;

// Dos instancias completas del backend contra la misma base y el mismo Redis,
// como dos réplicas de Railway: el proxy manda cada pedido a cualquiera.
describe('Con dos réplicas', () => {
  let first: TestApp;
  let second: TestApp;

  beforeAll(async () => {
    first = await createTestApp();
    second = await createTestApp();
  });

  beforeEach(() => resetDb(first.prisma));

  afterEach(() => jest.restoreAllMocks());

  afterAll(async () => {
    await first.close();
    await second.close();
  });

  // The counters outlive resetDb: every test uses its own addresses.
  let nextAddress = 1;
  const newAddress = () => `181.46.0.${nextAddress++}`;

  describe('límite de pedidos', () => {
    function search(replica: TestApp, user: User, ip: string) {
      return request(replica.app.getHttpServer())
        .get('/auth/users/search')
        .query({ q: 'alguien' })
        .set('Authorization', authHeader(replica.app, user))
        .set('X-Forwarded-For', ip);
    }

    async function searchUpToTheLimit(user: User, ip: string) {
      for (let i = 0; i < SEARCHES_PER_MINUTE / 2; i++) {
        await search(first, user, ip).expect(200);
        await search(second, user, ip).expect(200);
      }
    }

    it('un visitante que reparte sus pedidos entre las dos réplicas tiene un solo límite', async () => {
      const user = await createUser(first.prisma);
      const ip = newAddress();
      await searchUpToTheLimit(user, ip);

      const res = await search(first, user, ip).expect(429);

      expect((res.body as { message: string }).message).toBe(BUSY_MESSAGE);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('otro visitante conserva su propio límite en las dos réplicas', async () => {
      const busy = await createUser(first.prisma);
      const other = await createUser(first.prisma);
      const [busyIp, otherIp] = [newAddress(), newAddress()];
      await searchUpToTheLimit(busy, busyIp);
      await search(second, busy, busyIp).expect(429);

      await search(first, other, otherIp).expect(200);
      await search(second, other, otherIp).expect(200);
    });

    it('un escáner que reparte sus lecturas entre las dos réplicas tiene un solo límite', async () => {
      const scanner = await createUser(first.prisma);
      const door = newAddress();
      const scan = (replica: TestApp) =>
        request(replica.app.getHttpServer())
          .post('/tickets/check-in')
          .set('Authorization', authHeader(replica.app, scanner))
          .set('X-Forwarded-For', door)
          .send({ qrCode: randomUUID() });

      const statuses: number[] = [];
      for (let i = 0; i < SCANS_PER_MINUTE / 2; i++) {
        statuses.push((await scan(first)).status, (await scan(second)).status);
      }

      expect(statuses).not.toContain(429);
      await scan(first).expect(429);
    });
  });

  describe('tareas programadas', () => {
    // Each replica fires its own copy of the cron at the same moment.
    async function bothReplicasAt(
      time: number,
      run: (replica: TestApp) => Promise<void>,
    ) {
      jest.spyOn(Date, 'now').mockReturnValue(time);
      await Promise.all([run(first), run(second)]);
    }

    it('el cierre de eventos terminados corre una sola vez por turno', async () => {
      const finishes = [first, second].map((replica) =>
        jest.spyOn(
          replica.app.get(EventsRepository),
          'finishPublishedEventsEndedBefore',
        ),
      );
      const calls = () =>
        finishes.reduce((total, spy) => total + spy.mock.calls.length, 0);
      const finishEvents = (replica: TestApp) =>
        replica.app.get(EventsLifecycleService).handleFinishedEvents();
      const turn = Date.parse('2030-01-01T10:05:00Z');

      await bothReplicasAt(turn, finishEvents);
      expect(calls()).toBe(1);

      await bothReplicasAt(turn + FIVE_MINUTES_MS, finishEvents);
      expect(calls()).toBe(2);
    });

    it('la renovación diaria le pide a Mercado Pago un solo token nuevo por organizador', async () => {
      await createUser(first.prisma, {
        role: 'ORGANIZER',
        mercadoPagoAccessToken: mercadoPagoTokenCipher.encrypt(
          'APP_USR-current-token',
        ),
        mercadoPagoRefreshToken: mercadoPagoTokenCipher.encrypt('TG-old'),
        mercadoPagoTokenExpiresAt: new Date(Date.now() + 10 * DAY_MS),
      });
      jest.mocked(fetch).mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: 'APP_USR-new-token',
              refresh_token: 'TG-new',
              expires_in: TOKEN_TTL_S,
            }),
            { status: 200 },
          ),
        ),
      );
      const renewTokens = (replica: TestApp) =>
        replica.app.get(MercadoPagoOAuthService).handleTokenRenewal();

      await bothReplicasAt(Date.parse('2030-01-01T06:00:00Z'), renewTokens);

      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('clicks del link de un RRPP', () => {
    it('un visitante que entra por una réplica y recarga por la otra suma un solo click', async () => {
      const { event } = await createOrganizerWithEvent(first.prisma);
      const promoter = await createUser(first.prisma);
      const staff = await first.prisma.eventStaff.create({
        data: {
          eventId: event.id,
          userId: promoter.id,
          role: 'PROMOTER',
          status: 'ACCEPTED',
          commissionType: 'PERCENTAGE',
          commissionValue: 10,
        },
      });
      const visitor = newAddress();
      const visit = (replica: TestApp) =>
        request(replica.app.getHttpServer())
          .get(`/events/${event.id}?rpp=${staff.id}`)
          .set('X-Forwarded-For', visitor);

      await visit(first).expect(200);
      await visit(second).expect(200);

      const { clicks } = await first.prisma.eventStaff.findUniqueOrThrow({
        where: { id: staff.id },
      });
      expect(clicks).toBe(1);
    });
  });
});
