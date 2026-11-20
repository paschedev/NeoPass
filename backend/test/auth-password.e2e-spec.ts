import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type ResetMailJob = [string, { resetLink: string }];

const BUSY_MESSAGE =
  'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.';

describe('Contraseñas y sesiones', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  async function userWithPassword(password = 'clave-vieja-123') {
    return createUser(t.prisma, {
      passwordHash: await bcrypt.hash(password, 4),
    });
  }

  // A session issued a minute ago, like one opened on another device.
  function oldSession(user: { id: string; email: string; role: string }) {
    const token = t.app.get(JwtService).sign({
      email: user.email,
      sub: user.id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000) - 60,
    });
    return `Bearer ${token}`;
  }

  // Asking for a link has a limit per IP and hour that outlives resetDb: every
  // request comes from its own address.
  let nextAddress = 1;
  function forgotPassword(email: string, ip = `181.46.0.${nextAddress++}`) {
    return request(server())
      .post('/auth/forgot-password')
      .set('X-Forwarded-For', ip)
      .send({ email });
  }

  async function requestResetLink(email: string) {
    await forgotPassword(email).expect(201);
    const [, job] = t.queues.mail.add.mock.calls.at(-1) as ResetMailJob;
    return new URL(job.resetLink);
  }

  function login(email: string, password: string) {
    mockTurnstile(true);
    return request(server())
      .post('/auth/login')
      .send({ email, password, captchaToken: 'captcha-de-prueba' });
  }

  it('el mail de recuperación lleva a la página pública para elegir contraseña', async () => {
    const user = await userWithPassword();

    const link = await requestResetLink(user.email);

    expect(link.origin).toBe('https://app.neopass.test');
    expect(link.pathname).toBe('/reset-password');
    expect(link.searchParams.get('token')).toBeTruthy();
  });

  it('el token del link no queda guardado tal cual en la base', async () => {
    const user = await userWithPassword();

    const link = await requestResetLink(user.email);

    const saved = await t.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(saved.passwordResetToken).toBeTruthy();
    expect(saved.passwordResetToken).not.toBe(link.searchParams.get('token'));
  });

  it('con el link se elige una contraseña nueva y el link no sirve dos veces', async () => {
    const user = await userWithPassword();
    const token = (await requestResetLink(user.email)).searchParams.get(
      'token',
    );

    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'clave-nueva-456' })
      .expect(201);

    await login(user.email, 'clave-nueva-456').expect(201);
    await login(user.email, 'clave-vieja-123').expect(401);
    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'otra-clave-789' })
      .expect(400);
  });

  it('un link vencido no sirve', async () => {
    const user = await userWithPassword();
    const token = (await requestResetLink(user.email)).searchParams.get(
      'token',
    );
    await t.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetExpires: new Date(Date.now() - 1000) },
    });

    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'clave-nueva-456' })
      .expect(400);
  });

  it('restablecer la contraseña cierra las sesiones abiertas', async () => {
    const user = await userWithPassword();
    const session = oldSession(user);
    await request(server())
      .get('/auth/me')
      .set('Authorization', session)
      .expect(200);
    const token = (await requestResetLink(user.email)).searchParams.get(
      'token',
    );

    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'clave-nueva-456' })
      .expect(201);

    await request(server())
      .get('/auth/me')
      .set('Authorization', session)
      .expect(401);
  });

  it('cambiar la contraseña cierra las otras sesiones y devuelve una sesión nueva', async () => {
    const user = await userWithPassword();
    const otherDevice = oldSession(user);

    const res = await request(server())
      .post('/auth/change-password')
      .set('Authorization', oldSession(user))
      .send({ oldPassword: 'clave-vieja-123', newPassword: 'clave-nueva-456' })
      .expect(201);

    await request(server())
      .get('/auth/me')
      .set('Authorization', otherDevice)
      .expect(401);
    const newToken = (res.body as { access_token: string }).access_token;
    await request(server())
      .get('/auth/me')
      .set('Authorization', `Bearer ${newToken}`)
      .expect(200);
  });

  // 401 is reserved for an invalid session: the front logs the user out on it.
  it('equivocarse con la contraseña actual no cierra la sesión', async () => {
    const user = await userWithPassword();
    const session = oldSession(user);

    await request(server())
      .post('/auth/change-password')
      .set('Authorization', session)
      .send({ oldPassword: 'no-es-esta-123', newPassword: 'clave-nueva-456' })
      .expect(400);

    await request(server())
      .get('/auth/me')
      .set('Authorization', session)
      .expect(200);
  });

  it('la contraseña nueva tiene que tener al menos 8 caracteres', async () => {
    const user = await userWithPassword();
    const token = (await requestResetLink(user.email)).searchParams.get(
      'token',
    );

    await request(server())
      .post('/auth/reset-password')
      .send({ token, newPassword: 'corta7' })
      .expect(400);
    await request(server())
      .post('/auth/change-password')
      .set('Authorization', oldSession(user))
      .send({ oldPassword: 'clave-vieja-123', newPassword: 'corta7' })
      .expect(400);
  });

  describe('freno a los mails de recuperación', () => {
    const resetMails = () =>
      t.queues.mail.add.mock.calls.filter(
        ([name]) => name === 'send-password-reset',
      ) as ResetMailJob[];

    it('pedirlo dos veces en 5 minutos manda un solo mail y responde lo mismo las dos veces', async () => {
      const user = await userWithPassword();

      const first = await forgotPassword(user.email).expect(201);
      const second = await forgotPassword(user.email).expect(201);

      expect(second.body).toEqual(first.body);
      expect(resetMails()).toHaveLength(1);
    });

    it('el link del primer mail sigue sirviendo después de pedir otro', async () => {
      const user = await userWithPassword();
      await forgotPassword(user.email).expect(201);
      await forgotPassword(user.email).expect(201);
      const [[, job]] = resetMails();

      await request(server())
        .post('/auth/reset-password')
        .send({
          token: new URL(job.resetLink).searchParams.get('token'),
          newPassword: 'clave-nueva-456',
        })
        .expect(201);
    });

    it('pasados 5 minutos se puede pedir otro mail', async () => {
      const user = await userWithPassword();
      await forgotPassword(user.email).expect(201);
      // As if the first link had been sent 6 minutes ago.
      await t.prisma.user.update({
        where: { id: user.id },
        data: { passwordResetExpires: new Date(Date.now() + 54 * 60_000) },
      });

      await forgotPassword(user.email).expect(201);

      expect(resetMails()).toHaveLength(2);
    });

    it('el pedido número 11 en una hora desde la misma IP recibe el aviso', async () => {
      const ip = '181.46.1.1';
      for (let i = 0; i < 10; i++) {
        await forgotPassword(`nadie-${i}@neopass.test`, ip).expect(201);
      }

      const res = await forgotPassword('otro@neopass.test', ip).expect(429);

      expect((res.body as { message: string }).message).toBe(BUSY_MESSAGE);
    });
  });
});
