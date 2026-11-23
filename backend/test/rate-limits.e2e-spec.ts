import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createOrganizerWithEvent, createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const BUSY_MESSAGE =
  'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.';
const SEARCHES_PER_MINUTE = 20;
const SCANS_PER_MINUTE = 300;
const EVENT_VIEWS_PER_MINUTE = 300;

describe('Límites por minuto', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  // The counters live in Redis and outlive resetDb: every test uses its own
  // addresses.
  let nextAddress = 1;
  const newAddress = () => `181.45.0.${nextAddress++}`;

  describe('al superar un límite', () => {
    function search(user: Parameters<typeof authHeader>[1], ip: string) {
      return request(server())
        .get('/auth/users/search')
        .query({ q: 'alguien' })
        .set('Authorization', authHeader(t.app, user))
        .set('X-Forwarded-For', ip);
    }

    it('el usuario ve el mismo aviso que con la base saturada y cuándo reintentar', async () => {
      const user = await createUser(t.prisma);
      const ip = newAddress();
      for (let i = 0; i < SEARCHES_PER_MINUTE; i++) {
        await search(user, ip).expect(200);
      }

      const res = await search(user, ip).expect(429);

      expect((res.body as { message: string }).message).toBe(BUSY_MESSAGE);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });

    it('el sitio puede leer cuándo reintentar', async () => {
      const res = await request(server())
        .get('/events')
        .set('Origin', 'https://neopass.ar')
        .expect(200);

      expect(res.headers['access-control-expose-headers']).toMatch(
        /retry-after/i,
      );
    });
  });

  describe('IP del cliente detrás del proxy de Railway', () => {
    // Measured in production (2026-11-19): Railway replaces any
    // X-Forwarded-For the client sends with "client, edge node", and the
    // request reaches the app from an internal hop (here, the test's own
    // connection). Each edge node has its own public IP.
    const EDGE_A = '34.120.0.1';
    const EDGE_B = '34.120.0.2';
    const viaRailway = (forwardedFor: string) =>
      request(server()).get('/').set('X-Forwarded-For', forwardedFor);
    const remaining = (res: request.Response) =>
      Number(res.headers['x-ratelimit-remaining']);

    it('dos compradores que entran por el mismo nodo tienen cada uno su límite', async () => {
      const [first, second] = [newAddress(), newAddress()];
      await viaRailway(`${first}, ${EDGE_A}`).expect(200);

      const firstAgain = await viaRailway(`${first}, ${EDGE_A}`).expect(200);
      const other = await viaRailway(`${second}, ${EDGE_A}`).expect(200);

      expect(remaining(firstAgain)).toBe(98);
      expect(remaining(other)).toBe(99);
    });

    it('el mismo comprador que entra por dos nodos distintos tiene un solo límite', async () => {
      const buyer = newAddress();

      const first = await viaRailway(`${buyer}, ${EDGE_A}`).expect(200);
      const second = await viaRailway(`${buyer}, ${EDGE_B}`).expect(200);

      expect(remaining(first)).toBe(99);
      expect(remaining(second)).toBe(98);
    });

    it('una IP inventada en los encabezados no abre un límite nuevo', async () => {
      const buyer = newAddress();
      await viaRailway(`${buyer}, ${EDGE_A}`).expect(200);

      // Even if Railway kept what the client sends, ahead of the real address.
      const forged = await viaRailway(`203.0.113.7, ${buyer}, ${EDGE_A}`)
        .set('X-Real-IP', '198.51.100.9')
        .expect(200);
      const forgedAgain = await viaRailway(
        `198.51.100.8, ${buyer}, ${EDGE_B}`,
      ).expect(200);

      expect(remaining(forged)).toBe(98);
      expect(remaining(forgedAgain)).toBe(97);
    });

    it('el que llega al tope recibe el aviso y otro comprador del mismo nodo sigue', async () => {
      const [buyer, other] = [newAddress(), newAddress()];
      for (let i = 0; i < 100; i++) {
        await viaRailway(`${buyer}, ${i % 2 ? EDGE_A : EDGE_B}`).expect(200);
      }

      await viaRailway(`${buyer}, ${EDGE_A}`).expect(429);
      await viaRailway(`${other}, ${EDGE_A}`).expect(200);
    });
  });

  describe('escáneres de la puerta', () => {
    // Every scanner of a door shares the venue's WiFi, so the same IP.
    function scan(user: Parameters<typeof authHeader>[1], ip: string) {
      return request(server())
        .post('/tickets/check-in')
        .set('Authorization', authHeader(t.app, user))
        .set('X-Forwarded-For', ip)
        .send({ qrCode: randomUUID() });
    }

    async function scanTimes(
      user: Parameters<typeof authHeader>[1],
      ip: string,
      times: number,
    ) {
      const statuses: number[] = [];
      for (let i = 0; i < times; i++) {
        statuses.push((await scan(user, ip)).status);
      }
      return statuses;
    }

    it('dos escáneres de la misma puerta validan más de 100 entradas por minuto entre los dos', async () => {
      const door = newAddress();
      const first = await createUser(t.prisma);
      const second = await createUser(t.prisma);

      const statuses = [
        ...(await scanTimes(first, door, 110)),
        ...(await scanTimes(second, door, 110)),
      ];

      expect(statuses.filter((status) => status === 429)).toHaveLength(0);
    });

    it('un escáner que pasa los 300 escaneos por minuto recibe el aviso y otro de la misma puerta sigue validando', async () => {
      const door = newAddress();
      const fast = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const statuses = await scanTimes(fast, door, SCANS_PER_MINUTE);
      expect(statuses.filter((status) => status === 429)).toHaveLength(0);

      const blocked = await scan(fast, door).expect(429);

      expect((blocked.body as { message: string }).message).toBe(BUSY_MESSAGE);
      await scan(other, door).expect(201);
    });

    it('un escaneo sin sesión sigue respondiendo no autorizado', async () => {
      await request(server())
        .post('/tickets/check-in')
        .send({ qrCode: randomUUID() })
        .expect(401);
    });
  });

  describe('páginas públicas de eventos', () => {
    it('la página de un evento admite 300 aperturas por minuto desde una misma IP', async () => {
      const { event } = await createOrganizerWithEvent(t.prisma);
      const ip = newAddress();
      const open = () =>
        request(server()).get(`/events/${event.id}`).set('X-Forwarded-For', ip);
      for (let i = 0; i < EVENT_VIEWS_PER_MINUTE; i++) {
        await open().expect(200);
      }

      await open().expect(429);
    });

    it.each(['/events', '/events/:id/promoters'])(
      '%s admite 300 por minuto desde una misma IP',
      async (path) => {
        const { event } = await createOrganizerWithEvent(t.prisma);

        const res = await request(server())
          .get(path.replace(':id', event.id))
          .set('X-Forwarded-For', newAddress())
          .expect(200);

        expect(res.headers['x-ratelimit-limit']).toBe(
          String(EVENT_VIEWS_PER_MINUTE),
        );
      },
    );

    it('el resto de las rutas sigue con 100 por minuto', async () => {
      const res = await request(server())
        .get('/')
        .set('X-Forwarded-For', newAddress())
        .expect(200);

      expect(res.headers['x-ratelimit-limit']).toBe('100');
    });
  });

  // A load test runs from a single generator inside Railway: every simulated
  // buyer reaches the app from the same address, so LOAD_TEST_CLIENT_HEADER
  // (forbidden in production by validateEnv) names each one.
  describe('generador de una prueba de carga', () => {
    const LOAD_TEST_HEADER = 'x-load-test-client';
    const EDGE = '34.120.0.1';
    let nextClient = 1;
    const newClient = () => `comprador-${nextClient++}`;

    function fromGenerator(app: TestApp, ip: string, client?: string) {
      const req = request(app.app.getHttpServer())
        .get('/')
        .set('X-Forwarded-For', `${ip}, ${EDGE}`);
      return client ? req.set(LOAD_TEST_HEADER, client) : req;
    }
    const remaining = (res: request.Response) =>
      Number(res.headers['x-ratelimit-remaining']);

    it('sin LOAD_TEST_CLIENT_HEADER, inventar el encabezado no abre un límite nuevo', async () => {
      const ip = newAddress();

      const first = await fromGenerator(t, ip, newClient()).expect(200);
      const second = await fromGenerator(t, ip, newClient()).expect(200);

      expect(remaining(first)).toBe(99);
      expect(remaining(second)).toBe(98);
    });

    describe('con LOAD_TEST_CLIENT_HEADER (solo fuera de producción)', () => {
      let loadTest: TestApp;

      beforeAll(async () => {
        process.env.LOAD_TEST_CLIENT_HEADER = LOAD_TEST_HEADER;
        loadTest = await createTestApp();
      });

      afterAll(async () => {
        await loadTest.close();
        delete process.env.LOAD_TEST_CLIENT_HEADER;
      });

      it('cada comprador simulado tiene su propio límite aunque lleguen desde la misma IP', async () => {
        const ip = newAddress();
        const [buyer, other] = [newClient(), newClient()];

        await fromGenerator(loadTest, ip, buyer).expect(200);
        const buyerAgain = await fromGenerator(loadTest, ip, buyer).expect(200);
        const otherBuyer = await fromGenerator(loadTest, ip, other).expect(200);

        expect(remaining(buyerAgain)).toBe(98);
        expect(remaining(otherBuyer)).toBe(99);
      });

      it('un pedido sin el encabezado sigue contando por IP', async () => {
        const ip = newAddress();

        await fromGenerator(loadTest, ip).expect(200);
        const again = await fromGenerator(loadTest, ip).expect(200);
        const simulated = await fromGenerator(loadTest, ip, newClient()).expect(
          200,
        );

        expect(remaining(again)).toBe(98);
        expect(remaining(simulated)).toBe(99);
      });
    });
  });
});
