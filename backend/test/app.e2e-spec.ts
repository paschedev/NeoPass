import request from 'supertest';
import { createTestApp, TestApp } from './utils/test-app';
import { testEnv } from './setup/test-env';

describe('App configurada como en producción (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(() => t.close());

  it('rechaza con 400 un body que no cumple el DTO', async () => {
    await request(t.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'no-es-un-email', password: 'clave-de-prueba' })
      .expect(400);
  });

  it('responde con los headers de seguridad de helmet', async () => {
    const res = await request(t.app.getHttpServer()).get('/').expect(200);

    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('habilita CORS para el frontend configurado y no para otros orígenes', async () => {
    const allowed = await request(t.app.getHttpServer())
      .get('/')
      .set('Origin', testEnv.FRONTEND_URL);
    const blocked = await request(t.app.getHttpServer())
      .get('/')
      .set('Origin', 'https://otro-sitio.example');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      testEnv.FRONTEND_URL,
    );
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
