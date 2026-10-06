import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { UserRepository } from '../src/auth/repositories/user.repository';
import { googleMock } from './mocks/google-auth-library';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { googleCredential, TAMPERED_GOOGLE_CREDENTIAL } from './utils/google';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MailJob = [string, { resetLink: string }];
type SessionBody = { access_token: string; user: { id: string } };

const PASSWORD = 'clave-de-ana-123';
const NEEDS_PASSWORD = 'GOOGLE_LINK_NEEDS_PASSWORD';

describe('Entrar con Google', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  function signIn(credential: string) {
    return request(server()).post('/auth/google').send({ credential });
  }

  function link(credential: string, password: string) {
    return request(server())
      .post('/auth/google/link')
      .send({ credential, password });
  }

  async function accountWithPassword(email: string, data: Partial<User> = {}) {
    return createUser(t.prisma, {
      email,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      ...data,
    });
  }

  function googleOnlyAccount(email: string, googleId: string) {
    return createUser(t.prisma, {
      email,
      passwordHash: null,
      googleId,
      emailVerifiedAt: new Date(),
    });
  }

  function saved(id: string) {
    return t.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  // A session opened a minute ago, like one started with Google on a phone.
  function oldSession(user: User) {
    const token = t.app.get(JwtService).sign({
      email: user.email,
      sub: user.id,
      role: user.role,
      iat: Math.floor(Date.now() / 1000) - 60,
    });
    return `Bearer ${token}`;
  }

  describe('sin cuenta', () => {
    it('se crea una cuenta de comprador con el nombre y el email de Google, verificada y sin contraseña, y entra', async () => {
      const res = await signIn(
        googleCredential({
          sub: 'google-ana',
          email: 'Ana.Gomez@gmail.com',
          name: 'Ana Gómez',
        }),
      ).expect(201);

      const body = res.body as SessionBody & {
        user: { email: string; name: string; role: string };
      };
      expect(body.access_token).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        email: 'ana.gomez@gmail.com',
        name: 'Ana Gómez',
        role: 'CUSTOMER',
      });
      const user = await saved(body.user.id);
      expect(user).toMatchObject({
        googleId: 'google-ana',
        passwordHash: null,
        role: 'CUSTOMER',
      });
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('doble toque: se crea una sola cuenta y los dos pedidos entran a esa', async () => {
      const credential = googleCredential({ email: 'ana@gmail.com' });
      // Both requests find no account before either one is saved.
      const repository = t.app.get(UserRepository);
      const byEmail = jest
        .spyOn(repository, 'findByEmail')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      const byGoogle = jest
        .spyOn(repository, 'findByGoogleId')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      try {
        const first = await signIn(credential).expect(201);
        const second = await signIn(credential).expect(201);

        expect((second.body as SessionBody).user.id).toBe(
          (first.body as SessionBody).user.id,
        );
      } finally {
        byEmail.mockRestore();
        byGoogle.mockRestore();
      }
      expect(await t.prisma.user.count()).toBe(1);
    });
  });

  it('con la cuenta ya unida a esa cuenta de Google, entra', async () => {
    const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

    const res = await signIn(
      googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
    ).expect(201);

    expect((res.body as SessionBody).user.id).toBe(account.id);
  });

  describe('con una cuenta de email y contraseña', () => {
    it('todavía no entra: la respuesta avisa que hace falta la contraseña para unir Google', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      const res = await signIn(
        googleCredential({ email: 'ana@gmail.com' }),
      ).expect(409);

      expect(res.body).toMatchObject({
        code: NEEDS_PASSWORD,
        message:
          'Ya tenés una cuenta con este email. Ingresá tu contraseña para unir Google.',
      });
      expect((await saved(account.id)).googleId).toBeNull();
    });

    it('con la contraseña correcta quedan unidas, la cuenta queda verificada y entra', async () => {
      const account = await accountWithPassword('ana@gmail.com');
      const credential = googleCredential({
        sub: 'google-ana',
        email: 'ana@gmail.com',
      });

      const res = await link(credential, PASSWORD).expect(201);

      expect((res.body as SessionBody).user.id).toBe(account.id);
      const linked = await saved(account.id);
      expect(linked.googleId).toBe('google-ana');
      expect(linked.emailVerifiedAt).toBeInstanceOf(Date);
      // From now on Google is enough.
      await signIn(credential).expect(201);
    });

    it('con la contraseña incorrecta no se unen ni entra', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      await link(
        googleCredential({ email: 'ana@gmail.com' }),
        'otra-clave-123',
      ).expect(401);

      const after = await saved(account.id);
      expect(after.googleId).toBeNull();
      expect(after.emailVerifiedAt).toBeNull();
    });

    it('un Gmail escrito de otra forma es la misma cuenta: pide la contraseña para unir', async () => {
      const account = await accountWithPassword('juan.perez@gmail.com');
      const credential = googleCredential({ email: 'juanperez@gmail.com' });

      const res = await signIn(credential).expect(409);
      expect(res.body).toMatchObject({ code: NEEDS_PASSWORD });

      await link(credential, PASSWORD).expect(201);
      expect(await t.prisma.user.count()).toBe(1);
      expect((await saved(account.id)).googleId).not.toBeNull();
    });
  });

  it('si la cuenta está unida a otra cuenta de Google, no entra ni se une', async () => {
    const account = await accountWithPassword('ana@gmail.com', {
      googleId: 'google-vieja',
      emailVerifiedAt: new Date(),
    });
    const credential = googleCredential({
      sub: 'google-nueva',
      email: 'ana@gmail.com',
    });

    const res = await signIn(credential).expect(409);
    expect((res.body as { message: string }).message).toContain(
      'Olvidé mi contraseña',
    );
    await link(credential, PASSWORD).expect(409);

    expect((await saved(account.id)).googleId).toBe('google-vieja');
  });

  describe('si esa cuenta de Google ya está unida a otra cuenta de NeoPass', () => {
    it('porque cambió su email en Google, no entra y no se crea otra cuenta', async () => {
      await googleOnlyAccount('ana@empresa.com', 'google-ana');

      await signIn(
        googleCredential({ sub: 'google-ana', email: 'ana.nueva@gmail.com' }),
      ).expect(409);

      expect(await t.prisma.user.count()).toBe(1);
    });

    it('tampoco se une a otra cuenta que tenga el email nuevo', async () => {
      await googleOnlyAccount('ana@empresa.com', 'google-ana');
      const other = await accountWithPassword('ana.nueva@gmail.com');
      const credential = googleCredential({
        sub: 'google-ana',
        email: 'ana.nueva@gmail.com',
      });

      await signIn(credential).expect(409);
      await link(credential, PASSWORD).expect(409);

      expect((await saved(other.id)).googleId).toBeNull();
    });
  });

  it('una credencial adulterada, para otra app o emitida hace más de 10 minutos no entra', async () => {
    await signIn(TAMPERED_GOOGLE_CREDENTIAL).expect(401);
    await signIn(
      googleCredential({ email: 'ana@gmail.com', audience: 'otra-app' }),
    ).expect(401);
    await signIn(
      googleCredential({ email: 'ana@gmail.com', issuedMinutesAgo: 11 }),
    ).expect(401);

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('si no se pueden bajar las claves de Google, avisa que no está disponible y lo registra', async () => {
    googleMock.loadKeys.mockRejectedValue(new Error('Google no responde'));
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await signIn(googleCredential({ email: 'ana@gmail.com' })).expect(503);
      expect(logged).toHaveBeenCalledWith(
        'Could not load the Google sign-in keys',
        expect.anything(),
      );
    } finally {
      logged.mockRestore();
    }

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('si el email no está verificado en Google, no entra', async () => {
    await signIn(
      googleCredential({ email: 'ana@empresa.com', emailVerified: false }),
    ).expect(403);

    expect(await t.prisma.user.count()).toBe(0);
  });

  describe('contraseña', () => {
    it('ingresar con contraseña a una cuenta que solo tiene Google da "Credenciales inválidas"', async () => {
      await googleOnlyAccount('ana@gmail.com', 'google-ana');
      mockTurnstile(true);

      const res = await request(server())
        .post('/auth/login')
        .send({
          email: 'ana@gmail.com',
          password: 'cualquier-clave',
          captchaToken: 'captcha-de-prueba',
        })
        .expect(401);

      expect((res.body as { message: string }).message).toBe(
        'Credenciales inválidas',
      );
    });

    it('cambiar la contraseña en una cuenta que no tiene no se permite y explica cómo crearla', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

      const res = await request(server())
        .post('/auth/change-password')
        .set('Authorization', authHeader(t.app, account))
        .send({
          oldPassword: 'cualquier-clave',
          newPassword: 'clave-nueva-123',
        })
        .expect(400);

      expect((res.body as { message: string }).message).toContain(
        'Olvidé mi contraseña',
      );
      expect((await saved(account.id)).passwordHash).toBeNull();
    });

    async function resetPassword(email: string, newPassword: string) {
      await request(server())
        .post('/auth/forgot-password')
        .send({ email })
        .expect(201);
      const [, job] = t.queues.mail.add.mock.calls.at(-1) as MailJob;
      const token = new URL(job.resetLink).searchParams.get('token');
      await request(server())
        .post('/auth/reset-password')
        .send({ token, newPassword })
        .expect(201);
    }

    it('recuperar con el link verifica el email', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      await resetPassword('ana@gmail.com', 'clave-nueva-123');

      expect((await saved(account.id)).emailVerifiedAt).toBeInstanceOf(Date);
    });

    it('recuperar con el link desune Google y cierra todas las sesiones, también las abiertas con Google', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');
      const googleSession = oldSession(account);

      await resetPassword('ana@gmail.com', 'clave-nueva-123');

      expect((await saved(account.id)).googleId).toBeNull();
      await request(server())
        .get('/auth/me')
        .set('Authorization', googleSession)
        .expect(401);
      // Google asks once for the new password to link again.
      const credential = googleCredential({
        sub: 'google-ana',
        email: 'ana@gmail.com',
      });
      const res = await signIn(credential).expect(409);
      expect(res.body).toMatchObject({ code: NEEDS_PASSWORD });
      await link(credential, 'clave-nueva-123').expect(201);
    });
  });

  describe('registro con email y contraseña', () => {
    function register(email: string) {
      mockTurnstile(true);
      return request(server()).post('/auth/register').send({
        firstName: 'Ana',
        lastName: 'Gómez',
        email,
        password: PASSWORD,
        role: 'CUSTOMER',
        captchaToken: 'captcha-de-prueba',
      });
    }

    it('no verifica el email', async () => {
      const res = await register('ana@gmail.com').expect(201);

      const user = await saved((res.body as { id: string }).id);
      expect(user.emailVerifiedAt).toBeNull();
    });

    it('devuelve solo los datos del perfil', async () => {
      const res = await register('ana@gmail.com').expect(201);

      expect(Object.keys(res.body as object).sort()).toEqual([
        'email',
        'hasBeenRpp',
        'hasLinkedMp',
        'id',
        'isCurrentlyScanner',
        'name',
        'role',
      ]);
    });
  });
});
