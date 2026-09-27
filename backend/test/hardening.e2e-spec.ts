import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const SEARCHES_PER_MINUTE = 20;

describe('Endurecimientos', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  describe('firma para subir imágenes', () => {
    it('un cliente no la puede pedir', async () => {
      const customer = await createUser(t.prisma);

      await request(t.app.getHttpServer())
        .get('/media/presign')
        .set('Authorization', authHeader(t.app, customer))
        .expect(403);
    });

    it('un organizador sí', async () => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      const res = await request(t.app.getHttpServer())
        .get('/media/presign')
        .set('Authorization', authHeader(t.app, organizer))
        .expect(200);

      expect(res.body).toHaveProperty('signature');
    });
  });

  describe('búsqueda de usuarios', () => {
    function search(
      user: Parameters<typeof authHeader>[1],
      ip: string,
      q = 'buscada',
    ) {
      return request(t.app.getHttpServer())
        .get('/auth/users/search')
        .query({ q })
        .set('Authorization', authHeader(t.app, user))
        .set('X-Forwarded-For', ip);
    }

    it('no expone el rol de los usuarios', async () => {
      const user = await createUser(t.prisma);
      await createUser(t.prisma, { name: 'Persona buscada' });

      const res = await search(user, '10.0.0.1').expect(200);

      const [found] = res.body as Record<string, unknown>[];
      expect(found.name).toBe('Persona buscada');
      expect(found).not.toHaveProperty('role');
    });

    it('tiene un límite por minuto para cada IP', async () => {
      const user = await createUser(t.prisma);

      for (let i = 0; i < SEARCHES_PER_MINUTE; i++) {
        await search(user, '10.0.0.2').expect(200);
      }
      await search(user, '10.0.0.2').expect(429);
      await search(user, '10.0.0.3').expect(200);
    });
  });
});
