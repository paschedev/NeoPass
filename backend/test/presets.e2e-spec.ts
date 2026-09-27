import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('Presets de entradas', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  it('un organizador nuevo recibe General y VIP sin precio, como los muestra la UI', async () => {
    mockTurnstile(true);

    await request(t.app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Pro',
        lastName: 'Ductora',
        email: 'productora@neopass.test',
        password: 'Password123',
        role: 'ORGANIZER',
        phone: '+541123456789',
        captchaToken: 'captcha-de-prueba',
      })
      .expect(201);

    const presets = await t.prisma.ticketPreset.findMany({
      orderBy: { name: 'asc' },
    });
    expect(presets.map((p) => [p.name, Number(p.price)])).toEqual([
      ['General', 0],
      ['VIP', 0],
    ]);
  });

  it('listar los presets no crea ninguno por su cuenta', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

    const res = await request(t.app.getHttpServer())
      .get('/presets')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);

    expect(res.body).toEqual([]);
    expect(await t.prisma.ticketPreset.count()).toBe(0);
  });
});
