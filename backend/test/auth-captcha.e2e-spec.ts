import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const PASSWORD = 'Password123';

describe('Captcha en el login y el registro', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function createUserWithPassword() {
    return createUser(t.prisma, {
      passwordHash: bcrypt.hashSync(PASSWORD, 4),
    });
  }

  it('el login exige captcha aunque el pedido diga venir de localhost', async () => {
    const user = await createUserWithPassword();

    await request(t.app.getHttpServer())
      .post('/auth/login')
      .set('Host', 'localhost:3001')
      .send({ email: user.email, password: PASSWORD })
      .expect(400);
  });

  it('con un captcha válido el login abre la sesión', async () => {
    const user = await createUserWithPassword();
    mockTurnstile(true);

    const res = await request(t.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: PASSWORD,
        captchaToken: 'captcha-de-prueba',
      })
      .expect(201);

    const body = res.body as { access_token: string; user: { id: string } };
    expect(body.access_token).toBeTruthy();
    expect(body.user.id).toBe(user.id);
  });

  it('con un captcha rechazado por Turnstile el login falla', async () => {
    const user = await createUserWithPassword();
    mockTurnstile(false);

    await request(t.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user.email,
        password: PASSWORD,
        captchaToken: 'captcha-vencido',
      })
      .expect(400);
  });

  it('el registro exige captcha', async () => {
    await request(t.app.getHttpServer())
      .post('/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@neopass.test',
        password: PASSWORD,
        role: 'CUSTOMER',
      })
      .expect(400);

    expect(await t.prisma.user.count()).toBe(0);
  });
});
