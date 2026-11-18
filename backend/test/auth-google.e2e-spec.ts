import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { UserRepository } from '../src/auth/repositories/user.repository';
import { CURRENT_LEGAL_VERSIONS } from '../src/legal/legal-documents';
import { googleMock } from './mocks/google-auth-library';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { googleCredential, TAMPERED_GOOGLE_CREDENTIAL } from './utils/google';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MailJob = [string, { resetLink: string }];
type SessionBody = { access_token: string; user: { id: string } };
type CodeJob = { to: string; code: string };

const PASSWORD = 'clave-de-ana-123';
const NEEDS_PASSWORD = 'GOOGLE_LINK_NEEDS_PASSWORD';
const NEEDS_TERMS = 'GOOGLE_SIGN_UP_NEEDS_TERMS';
const ACCEPTED = {
  termsVersion: CURRENT_LEGAL_VERSIONS.TERMS,
  privacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY,
};

describe('Entrar con Google', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  function signIn(credential: string, accepted?: typeof ACCEPTED) {
    return request(server())
      .post('/auth/google')
      .send({ credential, ...accepted });
  }

  function link(credential: string, password: string) {
    return request(server())
      .post('/auth/google/link')
      .send({ credential, password });
  }

  function connect(user: User, credential: string) {
    return request(server())
      .post('/auth/google/connect')
      .set('Authorization', authHeader(t.app, user))
      .send({ credential });
  }

  function createPassword(user: User, credential: string, password: string) {
    return request(server())
      .post('/auth/google/password')
      .set('Authorization', authHeader(t.app, user))
      .send({ credential, password });
  }

  function loginWithPassword(email: string, password: string) {
    mockTurnstile(true);
    return request(server())
      .post('/auth/login')
      .send({ email, password, captchaToken: 'captcha-de-prueba' });
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

  // The security notices queued for that email.
  function linkNoticesTo(to: string) {
    const calls = t.queues.mail.add.mock.calls as [string, { to: string }][];
    return calls.filter(
      ([name, job]) => name === 'send-google-linked' && job.to === to,
    );
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
    it('primero pide aceptar los términos y no guarda nada', async () => {
      const res = await signIn(
        googleCredential({ email: 'Ana.Gomez@gmail.com' }),
      ).expect(409);

      expect(res.body).toMatchObject({
        code: NEEDS_TERMS,
        email: 'Ana.Gomez@gmail.com',
      });
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('con los términos vigentes aceptados se crea una cuenta de comprador con el nombre y el email de Google, confirmada y sin contraseña, y entra', async () => {
      const res = await signIn(
        googleCredential({
          sub: 'google-ana',
          email: 'Ana.Gomez@gmail.com',
          name: 'Ana Gómez',
        }),
        ACCEPTED,
      ).expect(201);

      const body = res.body as SessionBody & {
        user: Record<string, unknown>;
      };
      expect(body.access_token).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        email: 'ana.gomez@gmail.com',
        name: 'Ana Gómez',
        role: 'CUSTOMER',
        emailVerified: true,
        hasPassword: false,
        hasGoogle: true,
      });
      const user = await saved(body.user.id);
      expect(user).toMatchObject({
        googleId: 'google-ana',
        passwordHash: null,
        role: 'CUSTOMER',
      });
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
      const accepted = await t.prisma.legalAcceptance.findMany({
        where: { userId: user.id },
        orderBy: { document: 'asc' },
      });
      expect(accepted.map((a) => [a.document, a.version])).toEqual(
        expect.arrayContaining([
          ['TERMS', CURRENT_LEGAL_VERSIONS.TERMS],
          ['PRIVACY', CURRENT_LEGAL_VERSIONS.PRIVACY],
        ]),
      );
      expect(accepted).toHaveLength(2);
    });

    it('una versión vieja de los términos no sirve', async () => {
      await signIn(googleCredential({ email: 'ana@gmail.com' }), {
        ...ACCEPTED,
        termsVersion: CURRENT_LEGAL_VERSIONS.TERMS - 1,
      }).expect(400);

      expect(await t.prisma.user.count()).toBe(0);
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
        const first = await signIn(credential, ACCEPTED).expect(201);
        const second = await signIn(credential, ACCEPTED).expect(201);

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

  it('con la cuenta ya unida a esa cuenta de Google, entra sin pedir nada más', async () => {
    const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

    const res = await signIn(
      googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
    ).expect(201);

    expect((res.body as SessionBody).user.id).toBe(account.id);
  });

  describe('con una cuenta de email y contraseña', () => {
    describe('con el email confirmado en NeoPass', () => {
      it('un Gmail entra directo, queda unido y avisa por mail', async () => {
        const account = await accountWithPassword('ana@gmail.com', {
          emailVerifiedAt: new Date(),
        });
        const credential = googleCredential({
          sub: 'google-ana',
          email: 'ana@gmail.com',
        });

        const res = await signIn(credential).expect(201);

        expect((res.body as SessionBody).user.id).toBe(account.id);
        expect((await saved(account.id)).googleId).toBe('google-ana');
        expect(linkNoticesTo('ana@gmail.com')).toHaveLength(1);
        // The password still works.
        await loginWithPassword('ana@gmail.com', PASSWORD).expect(201);
      });

      it('un correo de empresa en Google Workspace entra directo', async () => {
        const account = await accountWithPassword('ana@empresa.com', {
          emailVerifiedAt: new Date(),
        });

        const res = await signIn(
          googleCredential({ email: 'ana@empresa.com', hd: 'empresa.com' }),
        ).expect(201);

        expect((res.body as SessionBody).user.id).toBe(account.id);
      });

      it('otro correo que Google solo verificó una vez pide la contraseña', async () => {
        const account = await accountWithPassword('ana@hotmail.com', {
          emailVerifiedAt: new Date(),
        });

        const res = await signIn(
          googleCredential({ email: 'ana@hotmail.com' }),
        ).expect(409);

        expect(res.body).toMatchObject({ code: NEEDS_PASSWORD });
        expect((await saved(account.id)).googleId).toBeNull();
      });
    });

    it('sin el email confirmado todavía no entra: pide la contraseña para conectar Google', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      const res = await signIn(
        googleCredential({ email: 'ana@gmail.com' }),
      ).expect(409);

      expect(res.body).toMatchObject({
        code: NEEDS_PASSWORD,
        message:
          'Ya tenés una cuenta con este email. Ingresá tu contraseña para conectar Google.',
        email: 'ana@gmail.com',
      });
      expect((await saved(account.id)).googleId).toBeNull();
      expect(linkNoticesTo('ana@gmail.com')).toHaveLength(0);
    });

    it('con la contraseña correcta quedan unidas, la cuenta queda confirmada, avisa por mail y entra', async () => {
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
      expect(linkNoticesTo('ana@gmail.com')).toHaveLength(1);
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
        ACCEPTED,
      ).expect(409);

      expect(await t.prisma.user.count()).toBe(1);
    });

    it('tampoco se une a otra cuenta que tenga el email nuevo', async () => {
      await googleOnlyAccount('ana@empresa.com', 'google-ana');
      const other = await accountWithPassword('ana.nueva@gmail.com', {
        emailVerifiedAt: new Date(),
      });
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
    await signIn(TAMPERED_GOOGLE_CREDENTIAL, ACCEPTED).expect(401);
    await signIn(
      googleCredential({ email: 'ana@gmail.com', audience: 'otra-app' }),
      ACCEPTED,
    ).expect(401);
    await signIn(
      googleCredential({ email: 'ana@gmail.com', issuedMinutesAgo: 11 }),
      ACCEPTED,
    ).expect(401);

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('si no se pueden bajar las claves de Google, avisa que no está disponible y lo registra', async () => {
    googleMock.loadKeys.mockRejectedValue(new Error('Google no responde'));
    const logged = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    try {
      await signIn(
        googleCredential({ email: 'ana@gmail.com' }),
        ACCEPTED,
      ).expect(503);
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
      ACCEPTED,
    ).expect(403);

    expect(await t.prisma.user.count()).toBe(0);
  });

  describe('conectar Google con la sesión abierta', () => {
    it('con la cuenta de Google del mismo email queda unida, confirmada y avisa por mail', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      const res = await connect(
        account,
        googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
      ).expect(201);

      expect(res.body).toMatchObject({
        id: account.id,
        hasGoogle: true,
        hasPassword: true,
        emailVerified: true,
      });
      expect((await saved(account.id)).googleId).toBe('google-ana');
      expect(linkNoticesTo('ana@gmail.com')).toHaveLength(1);
    });

    it('con otro email no se une', async () => {
      const account = await accountWithPassword('ana@gmail.com');

      const res = await connect(
        account,
        googleCredential({ email: 'otra@gmail.com' }),
      ).expect(400);

      expect((res.body as { message: string }).message).toContain(
        'ana@gmail.com',
      );
      expect((await saved(account.id)).googleId).toBeNull();
    });

    it('si ya tiene una cuenta de Google conectada, lo dice', async () => {
      const account = await accountWithPassword('ana@gmail.com', {
        googleId: 'google-vieja',
        emailVerifiedAt: new Date(),
      });

      const res = await connect(
        account,
        googleCredential({ sub: 'google-nueva', email: 'ana@gmail.com' }),
      ).expect(409);

      expect((res.body as { message: string }).message).toBe(
        'Ya tenés una cuenta de Google conectada.',
      );
    });

    it('una cuenta de Google que ya está en otra cuenta de NeoPass no se une', async () => {
      await googleOnlyAccount('ana@empresa.com', 'google-ana');
      const account = await accountWithPassword('ana@gmail.com');

      await connect(
        account,
        googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
      ).expect(409);

      expect((await saved(account.id)).googleId).toBeNull();
    });

    it('sin sesión no se puede', async () => {
      await request(server())
        .post('/auth/google/connect')
        .send({ credential: googleCredential({ email: 'ana@gmail.com' }) })
        .expect(401);
    });
  });

  describe('crear una contraseña en una cuenta hecha con Google', () => {
    it('con una credencial de Google reciente de esa cuenta: después entra de las dos formas', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');
      const credential = googleCredential({
        sub: 'google-ana',
        email: 'ana@gmail.com',
      });

      const res = await createPassword(
        account,
        credential,
        'clave-nueva-123',
      ).expect(201);

      expect(res.body).toMatchObject({ hasPassword: true, hasGoogle: true });
      await loginWithPassword('ana@gmail.com', 'clave-nueva-123').expect(201);
      await signIn(credential).expect(201);
      // The session that created it stays open.
      await request(server())
        .get('/auth/me')
        .set('Authorization', authHeader(t.app, account))
        .expect(200);
    });

    it('con otra cuenta de Google no se puede', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

      await createPassword(
        account,
        googleCredential({ sub: 'google-otra', email: 'ana@gmail.com' }),
        'clave-nueva-123',
      ).expect(403);

      expect((await saved(account.id)).passwordHash).toBeNull();
    });

    it('si ya tiene contraseña, no la reemplaza', async () => {
      const account = await accountWithPassword('ana@gmail.com', {
        googleId: 'google-ana',
        emailVerifiedAt: new Date(),
      });

      await createPassword(
        account,
        googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
        'clave-nueva-123',
      ).expect(409);

      await loginWithPassword('ana@gmail.com', PASSWORD).expect(201);
    });

    it('una contraseña de menos de 8 caracteres no sirve', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

      await createPassword(
        account,
        googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
        'corta',
      ).expect(400);
    });

    it('sin sesión no se puede', async () => {
      await request(server())
        .post('/auth/google/password')
        .send({
          credential: googleCredential({ email: 'ana@gmail.com' }),
          password: 'clave-nueva-123',
        })
        .expect(401);
    });
  });

  describe('contraseña', () => {
    it('ingresar con contraseña a una cuenta que solo tiene Google da "Credenciales inválidas"', async () => {
      await googleOnlyAccount('ana@gmail.com', 'google-ana');

      const res = await loginWithPassword(
        'ana@gmail.com',
        'cualquier-clave',
      ).expect(401);

      expect((res.body as { message: string }).message).toBe(
        'Credenciales inválidas',
      );
    });

    it('cambiar la contraseña en una cuenta que no tiene no se permite y explica dónde crearla', async () => {
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
        'Configuración',
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

    it('recuperar con el link desune Google y cierra todas las sesiones; con el email confirmado, Google vuelve a entrar directo', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');
      const googleSession = oldSession(account);

      await resetPassword('ana@gmail.com', 'clave-nueva-123');

      expect((await saved(account.id)).googleId).toBeNull();
      await request(server())
        .get('/auth/me')
        .set('Authorization', googleSession)
        .expect(401);
      const res = await signIn(
        googleCredential({ sub: 'google-ana', email: 'ana@gmail.com' }),
      ).expect(201);
      expect((res.body as SessionBody).user.id).toBe(account.id);
      expect((await saved(account.id)).googleId).toBe('google-ana');
    });
  });

  describe('cambiar el email', () => {
    it('una cuenta sin contraseña tiene que crearla antes', async () => {
      const account = await googleOnlyAccount('ana@gmail.com', 'google-ana');

      const res = await request(server())
        .post('/auth/email/change')
        .set('Authorization', authHeader(t.app, account))
        .send({ newEmail: 'ana.nueva@gmail.com', password: 'cualquier-clave' })
        .expect(400);

      expect((res.body as { message: string }).message).toBe(
        'Creá una contraseña antes de cambiar el correo.',
      );
    });

    it('al confirmar el correo nuevo, Google queda desunido', async () => {
      const account = await accountWithPassword('ana@gmail.com', {
        googleId: 'google-ana',
        emailVerifiedAt: new Date(),
      });
      await request(server())
        .post('/auth/email/change')
        .set('Authorization', authHeader(t.app, account))
        .send({ newEmail: 'ana.nueva@gmail.com', password: PASSWORD })
        .expect(201);
      const [, job] = t.queues.mail.add.mock.calls.find(
        ([name]) => name === 'send-email-code',
      ) as [string, CodeJob];

      await request(server())
        .post('/auth/email/confirm')
        .set('Authorization', authHeader(t.app, account))
        .send({ code: job.code })
        .expect(201);

      const after = await saved(account.id);
      expect(after.email).toBe('ana.nueva@gmail.com');
      expect(after.googleId).toBeNull();
    });
  });

  it('registrarse con email y contraseña no confirma el email', async () => {
    mockTurnstile(true);
    const res = await request(server())
      .post('/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'Gómez',
        email: 'ana@gmail.com',
        password: PASSWORD,
        role: 'CUSTOMER',
        captchaToken: 'captcha-de-prueba',
        ...ACCEPTED,
      })
      .expect(201);

    const user = await saved((res.body as SessionBody).user.id);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.googleId).toBeNull();
  });
});
