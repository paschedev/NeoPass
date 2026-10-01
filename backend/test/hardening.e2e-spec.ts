import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import request from 'supertest';
import { testEnv } from './setup/test-env';
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

  describe('CORS', () => {
    function allowedOrigin(origin: string) {
      return request(t.app.getHttpServer())
        .get('/events')
        .set('Origin', origin)
        .expect(200)
        .then((res) => res.headers['access-control-allow-origin']);
    }

    it.each([
      'https://neopass.ar',
      'https://www.neopass.ar',
      testEnv.FRONTEND_URL,
      'http://localhost:3000',
    ])('acepta pedidos desde %s', async (origin) => {
      expect(await allowedOrigin(origin)).toBe(origin);
    });

    it.each([
      'https://ventipass.com',
      'https://neopass.com',
      'https://venti-pass.vercel.app',
    ])('no acepta pedidos desde %s', async (origin) => {
      expect(await allowedOrigin(origin)).toBeUndefined();
    });
  });

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

    it('si Cloudinary no puede firmar, responde 500 sin detalles internos y el error queda en el log', async () => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });
      const sign = jest
        .spyOn(cloudinary.utils, 'api_sign_request')
        .mockImplementation(() => {
          throw new Error('Must supply api_secret');
        });
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      try {
        const res = await request(t.app.getHttpServer())
          .get('/media/presign')
          .set('Authorization', authHeader(t.app, organizer))
          .expect(500);

        expect(JSON.stringify(res.body)).not.toContain('api_secret');
        expect(logError.mock.calls.flat().map(String).join(' ')).toContain(
          'Must supply api_secret',
        );
      } finally {
        sign.mockRestore();
        logError.mockRestore();
      }
    });
  });

  describe('IDs mal formados en la ruta', () => {
    // Un ID que no es UUID no puede existir; con un carácter nulo, además, la
    // base rechaza la consulta.
    const MALFORMED_ID = 'no-es-un-id%00';

    it.each([
      ['get', '/events/:id', undefined],
      ['get', '/events/:id/promoters', undefined],
      ['get', '/events/organizer/:id', undefined],
      ['put', '/events/:id', {}],
      ['put', '/events/:id/batches', { batches: [] }],
      ['post', '/events/:id/staff', { userId: randomUUID(), role: 'SCANNER' }],
      ['get', '/events/:id/staff', undefined],
      ['get', '/events/promoter/me/:id/stats', undefined],
      ['put', '/events/staff/:id/accept', undefined],
      ['put', '/events/staff/:id/reject', undefined],
      ['post', '/tickets/:id/transfer', { targetUserId: randomUUID() }],
      ['put', '/presets/:id', { name: 'Campo', price: 0 }],
      ['delete', '/presets/:id', undefined],
      ['put', '/notifications/:id/read', undefined],
      ['delete', '/notifications/:id', undefined],
    ] as const)('%s %s responde 404', async (method, path, body) => {
      const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

      const res = await request(t.app.getHttpServer())
        [method](path.replace(':id', MALFORMED_ID))
        .set('Authorization', authHeader(t.app, organizer))
        .send(body)
        .expect(404);

      expect((res.body as { message: string }).message).toBe(
        'No encontramos lo que buscás',
      );
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
