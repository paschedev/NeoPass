import * as bcrypt from 'bcrypt';
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type CodeJob = { to: string; code: string; purpose: 'VERIFY' | 'CHANGE' };
type NoticeJob = { to: string; newEmail: string };
type Profile = { email: string; emailVerified: boolean };

const PASSWORD = 'clave-segura-123';
const MINUTE_MS = 60 * 1000;

const messageOf = (res: { body: unknown }) =>
  (res.body as { message: string | string[] }).message;

describe('Confirmar y cambiar el correo', () => {
  let t: TestApp;
  // Each test talks from its own IP: the per-IP limits don't leak between tests.
  let ipCount = 0;
  let ip: string;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    ip = `10.1.0.${++ipCount}`;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    t.queues.mail.add.mockReset();
  });

  afterAll(() => t.close());

  const http = () => request(t.app.getHttpServer());

  function register(email = 'ana@neopass.test') {
    mockTurnstile(true);
    return http().post('/auth/register').set('X-Forwarded-For', ip).send({
      firstName: 'Ana',
      lastName: 'Pérez',
      email,
      password: PASSWORD,
      role: 'CUSTOMER',
      captchaToken: 'captcha-de-prueba',
    });
  }

  async function userWithPassword(data: Parameters<typeof createUser>[1] = {}) {
    const user = await createUser(t.prisma, {
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      ...data,
    });
    return { user, session: authHeader(t.app, user) };
  }

  const post = (path: string, session: string, body: object = {}) =>
    http()
      .post(path)
      .set('Authorization', session)
      .set('X-Forwarded-For', ip)
      .send(body);

  const askCode = (session: string) =>
    post('/auth/email/verification', session);
  const askChange = (session: string, newEmail: string, password = PASSWORD) =>
    post('/auth/email/change', session, { newEmail, password });
  const confirm = (session: string, code: string) =>
    post('/auth/email/confirm', session, { code });

  const me = async (session: string) =>
    (
      await http()
        .get('/auth/me')
        .set('Authorization', session)
        .set('X-Forwarded-For', ip)
        .expect(200)
    ).body as Profile;

  function mailJobs<T>(name: string) {
    return t.queues.mail.add.mock.calls
      .filter(([jobName]) => jobName === name)
      .map(([, job]) => job as T);
  }

  // The last code mailed to that address.
  function codeSentTo(to: string) {
    const job = mailJobs<CodeJob>('send-email-code')
      .filter((sent) => sent.to === to)
      .at(-1);
    if (!job) throw new Error(`No code was mailed to ${to}`);
    return job;
  }

  // Lets the next code be asked for without waiting the minute.
  const skipCooldown = (userId: string) =>
    t.prisma.emailCode.update({
      where: { userId },
      data: { sentAt: new Date(Date.now() - 2 * MINUTE_MS) },
    });

  const wrongCode = (code: string) =>
    String((Number(code) + 1) % 1_000_000).padStart(6, '0');

  function login(email: string) {
    mockTurnstile(true);
    return http()
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password: PASSWORD, captchaToken: 'captcha-de-prueba' });
  }

  describe('confirmar el correo', () => {
    it('al registrarse la cuenta queda sin confirmar, con la sesión iniciada, y le llega un código de 6 números', async () => {
      const res = await register().expect(201);
      const body = res.body as { access_token: string; user: Profile };

      expect(body.user).toMatchObject({
        email: 'ana@neopass.test',
        emailVerified: false,
      });
      const session = `Bearer ${body.access_token}`;
      expect(await me(session)).toMatchObject({ emailVerified: false });
      const job = codeSentTo('ana@neopass.test');
      expect(job.code).toMatch(/^\d{6}$/);
      expect(job.purpose).toBe('VERIFY');
    });

    it('con el código correcto el correo queda confirmado y el mismo código no sirve dos veces', async () => {
      const { access_token } = (await register().expect(201)).body as {
        access_token: string;
      };
      const session = `Bearer ${access_token}`;
      const { code } = codeSentTo('ana@neopass.test');

      const res = await confirm(session, code).expect(201);

      expect(res.body).toMatchObject({ emailVerified: true });
      expect(await me(session)).toMatchObject({ emailVerified: true });
      const again = await confirm(session, code).expect(400);
      expect(messageOf(again)).toBe(
        'No hay un código pendiente. Pedí uno nuevo.',
      );
    });

    it('con un código incorrecto avisa cuántos intentos quedan y al quinto error deja de servir', async () => {
      const { user, session } = await userWithPassword();
      await askCode(session).expect(201);
      const { code } = codeSentTo(user.email);

      const messages: string[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await confirm(session, wrongCode(code)).expect(400);
        messages.push(messageOf(res));
      }

      expect(messages).toEqual([
        'El código no es correcto. Te quedan 4 intentos.',
        'El código no es correcto. Te quedan 3 intentos.',
        'El código no es correcto. Te quedan 2 intentos.',
        'El código no es correcto. Te queda 1 intento.',
        'El código no es correcto. Pedí uno nuevo.',
      ]);
      const exhausted = await confirm(session, code).expect(400);
      expect(messageOf(exhausted)).toBe(
        'Probaste demasiadas veces. Pedí un código nuevo.',
      );
      expect(await me(session)).toMatchObject({ emailVerified: false });
    });

    it('el código vence a los 15 minutos', async () => {
      const { user, session } = await userWithPassword();
      await askCode(session).expect(201);
      const pending = await t.prisma.emailCode.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(pending.expiresAt.getTime() - pending.sentAt.getTime()).toBe(
        15 * MINUTE_MS,
      );
      await t.prisma.emailCode.update({
        where: { userId: user.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const res = await confirm(session, codeSentTo(user.email).code).expect(
        400,
      );

      expect(messageOf(res)).toBe('El código venció. Pedí uno nuevo.');
    });

    it('pedir otro código antes de 60 segundos pide esperar; después sale uno nuevo y el anterior deja de servir', async () => {
      const { user, session } = await userWithPassword();
      await askCode(session).expect(201);
      const first = codeSentTo(user.email).code;

      const tooSoon = await askCode(session).expect(429);
      expect(messageOf(tooSoon)).toMatch(
        /^Esperá (60|59) segundos para pedir otro código$/,
      );

      await skipCooldown(user.id);
      const res = await askCode(session).expect(201);
      expect(res.body).toEqual({ sentTo: user.email });
      const second = codeSentTo(user.email).code;
      if (second !== first) {
        await confirm(session, first).expect(400);
      }
      await confirm(session, second).expect(201);
    });

    it('se mandan como mucho 5 códigos por hora por cuenta', async () => {
      const { user, session } = await userWithPassword();
      for (let i = 0; i < 5; i++) {
        await askCode(session).expect(201);
        await skipCooldown(user.id);
      }

      const capped = await askCode(session).expect(429);
      expect(messageOf(capped)).toBe(
        'Llegaste al máximo de 5 códigos por hora. Probá de nuevo más tarde.',
      );
      expect(mailJobs('send-email-code')).toHaveLength(5);

      await t.prisma.emailCode.update({
        where: { userId: user.id },
        data: { windowStartedAt: new Date(Date.now() - 61 * MINUTE_MS) },
      });
      await askCode(session).expect(201);
    });

    it('con el correo ya confirmado no se manda otro código', async () => {
      const { session } = await userWithPassword({
        emailVerifiedAt: new Date(),
      });

      const res = await askCode(session).expect(409);

      expect(messageOf(res)).toBe('Tu correo ya está confirmado');
      expect(mailJobs('send-email-code')).toHaveLength(0);
    });

    it('si el mail del registro no se puede encolar, la cuenta se crea igual y se puede pedir otro código', async () => {
      t.queues.mail.add.mockRejectedValueOnce(new Error('Redis no responde'));
      const logError = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);

      const res = await register().expect(201);

      expect(logError).toHaveBeenCalled();
      const user = await t.prisma.user.findUniqueOrThrow({
        where: { email: 'ana@neopass.test' },
      });
      await skipCooldown(user.id);
      const session = `Bearer ${(res.body as { access_token: string }).access_token}`;
      await askCode(session).expect(201);
      expect(codeSentTo('ana@neopass.test').code).toMatch(/^\d{6}$/);
    });

    it('recuperar la contraseña con el link confirma el correo y anula el código pendiente', async () => {
      const { user, session } = await userWithPassword();
      await askCode(session).expect(201);

      await http()
        .post('/auth/forgot-password')
        .send({ email: user.email })
        .expect(201);
      const [, resetJob] = t.queues.mail.add.mock.calls
        .filter(([name]) => name === 'send-password-reset')
        .at(-1) as [string, { resetLink: string }];
      const token = new URL(resetJob.resetLink).searchParams.get('token');
      await http()
        .post('/auth/reset-password')
        .send({ token, newPassword: 'clave-nueva-456' })
        .expect(201);

      const saved = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { emailCode: true },
      });
      expect(saved.emailVerifiedAt).not.toBeNull();
      expect(saved.emailCode).toBeNull();
    });
  });

  describe('cambiar el correo', () => {
    it('con la contraseña incorrecta no manda nada', async () => {
      const { session } = await userWithPassword();

      const res = await askChange(
        session,
        'nuevo@neopass.test',
        'otra-clave-999',
      ).expect(400);

      expect(messageOf(res)).toBe('La contraseña es incorrecta');
      expect(mailJobs('send-email-code')).toHaveLength(0);
    });

    it('el mismo correo, aunque cambien las mayúsculas o los puntos de Gmail, ya es el suyo', async () => {
      const { session } = await userWithPassword({
        email: 'juan.perez@gmail.com',
      });

      const res = await askChange(session, 'JuanPerez@gmail.com').expect(400);

      expect(messageOf(res)).toBe('Ese ya es tu correo');
    });

    it('un correo que ya tiene otra cuenta no se puede usar', async () => {
      const { session } = await userWithPassword();
      await createUser(t.prisma, { email: 'ocupado@neopass.test' });

      const res = await askChange(session, 'Ocupado@neopass.test').expect(409);

      expect(messageOf(res)).toBe('Ese correo ya tiene una cuenta en NeoPass');
      expect(mailJobs('send-email-code')).toHaveLength(0);
    });

    it('el código va al correo nuevo y hasta escribirlo la cuenta sigue con el de antes', async () => {
      const { user, session } = await userWithPassword({
        email: 'viejo@neopass.test',
      });

      const res = await askChange(session, ' Nuevo@neopass.test ').expect(201);

      expect(res.body).toEqual({ sentTo: 'Nuevo@neopass.test' });
      expect(codeSentTo('Nuevo@neopass.test').purpose).toBe('CHANGE');
      const saved = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(saved.email).toBe('viejo@neopass.test');
      await login('viejo@neopass.test').expect(201);
    });

    it('con el código la cuenta pasa al correo nuevo, confirmado; se entra con el nuevo, no con el viejo, y los links de recuperación pendientes dejan de servir', async () => {
      const { session } = await userWithPassword({
        email: 'viejo@neopass.test',
      });
      await http()
        .post('/auth/forgot-password')
        .send({ email: 'viejo@neopass.test' })
        .expect(201);
      const [, resetJob] = t.queues.mail.add.mock.calls.at(-1) as [
        string,
        { resetLink: string },
      ];
      await askChange(session, 'nuevo@neopass.test').expect(201);

      const res = await confirm(
        session,
        codeSentTo('nuevo@neopass.test').code,
      ).expect(201);

      expect(res.body).toMatchObject({
        email: 'nuevo@neopass.test',
        emailVerified: true,
      });
      await login('nuevo@neopass.test').expect(201);
      await login('viejo@neopass.test').expect(401);
      await http()
        .post('/auth/reset-password')
        .send({
          token: new URL(resetJob.resetLink).searchParams.get('token'),
          newPassword: 'clave-nueva-456',
        })
        .expect(400);
    });

    it('si el correo viejo estaba confirmado, le llega un aviso con el nuevo enmascarado', async () => {
      const { session } = await userWithPassword({
        email: 'viejo@neopass.test',
        emailVerifiedAt: new Date(),
      });
      await askChange(session, 'nuevo@neopass.test').expect(201);

      await confirm(session, codeSentTo('nuevo@neopass.test').code).expect(201);

      expect(mailJobs<NoticeJob>('send-email-changed')).toEqual([
        expect.objectContaining({
          to: 'viejo@neopass.test',
          newEmail: 'n***o@neopass.test',
        }),
      ]);
    });

    it('si el correo viejo nunca se confirmó, no se le manda nada', async () => {
      const { session } = await userWithPassword({
        email: 'mal-escrito@gmial.com',
      });
      await askChange(session, 'bien-escrito@gmail.com').expect(201);

      await confirm(session, codeSentTo('bien-escrito@gmail.com').code).expect(
        201,
      );

      expect(mailJobs('send-email-changed')).toHaveLength(0);
    });

    it('si alguien crea una cuenta con el correo nuevo antes de confirmar, no cambia nada', async () => {
      const { user, session } = await userWithPassword({
        email: 'viejo@neopass.test',
      });
      await askChange(session, 'nuevo@neopass.test').expect(201);
      await createUser(t.prisma, { email: 'nuevo@neopass.test' });

      const res = await confirm(
        session,
        codeSentTo('nuevo@neopass.test').code,
      ).expect(409);

      expect(messageOf(res)).toBe('Ese correo ya tiene una cuenta en NeoPass');
      const saved = await t.prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        include: { emailCode: true },
      });
      expect(saved.email).toBe('viejo@neopass.test');
      expect(saved.emailCode).toBeNull();
    });

    it('pedir un cambio y después la confirmación deja solo el último código', async () => {
      const { user, session } = await userWithPassword({
        email: 'viejo@neopass.test',
      });
      await askChange(session, 'nuevo@neopass.test').expect(201);
      const changeCode = codeSentTo('nuevo@neopass.test').code;
      await skipCooldown(user.id);
      await askCode(session).expect(201);
      const verifyCode = codeSentTo('viejo@neopass.test').code;

      if (changeCode !== verifyCode) {
        await confirm(session, changeCode).expect(400);
      }
      const res = await confirm(session, verifyCode).expect(201);

      expect(res.body).toMatchObject({
        email: 'viejo@neopass.test',
        emailVerified: true,
      });
    });
  });

  describe('en todos los casos', () => {
    it('sin sesión las rutas nuevas responden 401', async () => {
      await http().post('/auth/email/verification').expect(401);
      await http()
        .post('/auth/email/change')
        .send({ newEmail: 'nuevo@neopass.test', password: PASSWORD })
        .expect(401);
      await http()
        .post('/auth/email/confirm')
        .send({ code: '123456' })
        .expect(401);
    });

    it('el código no se guarda tal cual en la base', async () => {
      const { user, session } = await userWithPassword();
      await askCode(session).expect(201);
      const { code } = codeSentTo(user.email);

      const saved = await t.prisma.emailCode.findUniqueOrThrow({
        where: { userId: user.id },
      });

      expect(saved.codeHash).not.toContain(code);
      expect(await bcrypt.compare(code, saved.codeHash)).toBe(true);
    });

    it('el código tiene que ser de 6 números', async () => {
      const { session } = await userWithPassword();

      const res = await confirm(session, '12a45').expect(400);

      expect(messageOf(res)).toEqual(['El código tiene 6 números']);
    });

    it('dos confirmaciones al mismo tiempo con el código correcto cuentan una sola vez', async () => {
      const { session } = await userWithPassword({
        email: 'viejo@neopass.test',
        emailVerifiedAt: new Date(),
      });
      await askChange(session, 'nuevo@neopass.test').expect(201);
      const { code } = codeSentTo('nuevo@neopass.test');

      const results = await Promise.all([
        confirm(session, code),
        confirm(session, code),
      ]);

      expect(results.map((res) => res.status).sort()).toEqual([201, 400]);
      expect(mailJobs('send-email-changed')).toHaveLength(1);
    });

    it('"cambiar correo" acepta 10 intentos por minuto desde la misma IP', async () => {
      const { session } = await userWithPassword();

      for (let i = 0; i < 10; i++) {
        await askChange(session, 'nuevo@neopass.test', 'otra-clave').expect(
          400,
        );
      }

      await askChange(session, 'nuevo@neopass.test').expect(429);
    });
  });
});
