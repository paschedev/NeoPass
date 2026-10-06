import request from 'supertest';
import { UserRepository } from '../src/auth/repositories/user.repository';
import { createUser } from './utils/factories';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

type MailJob = [string, { to: string }];

const PASSWORD = 'Password123';

describe('Un email por cuenta, sin importar mayúsculas ni cómo se escribe un Gmail', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  const server = () => t.app.getHttpServer();

  function register(email: string) {
    mockTurnstile(true);
    return request(server()).post('/auth/register').send({
      firstName: 'Ana',
      lastName: 'Pérez',
      email,
      password: PASSWORD,
      role: 'CUSTOMER',
      captchaToken: 'captcha-de-prueba',
    });
  }

  function login(email: string) {
    mockTurnstile(true);
    return request(server())
      .post('/auth/login')
      .send({ email, password: PASSWORD, captchaToken: 'captcha-de-prueba' });
  }

  async function savedEmails() {
    const users = await t.prisma.user.findMany({
      select: { email: true },
      orderBy: { createdAt: 'asc' },
    });
    return users.map((user) => user.email);
  }

  it('quien se registra con mayúsculas o espacios queda guardado en minúsculas y sin espacios', async () => {
    await register('  Ana.Perez@Mail.COM ').expect(201);

    expect(await savedEmails()).toEqual(['ana.perez@mail.com']);
  });

  it('no se puede registrar el mismo email cambiando las mayúsculas', async () => {
    await register('ana@mail.com').expect(201);

    await register('ANA@Mail.com').expect(409);

    expect(await savedEmails()).toEqual(['ana@mail.com']);
  });

  it('no se puede registrar el mismo Gmail con otros puntos, con +algo o con googlemail.com', async () => {
    await register('juan.perez@gmail.com').expect(201);

    await register('juanperez@gmail.com').expect(409);
    await register('juan.perez+entradas@gmail.com').expect(409);
    await register('Juan.Perez@googlemail.com').expect(409);

    expect(await savedEmails()).toEqual(['juan.perez@gmail.com']);
  });

  it('en otros dominios los puntos y el + sí distinguen cuentas', async () => {
    await register('juan.perez@empresa.com').expect(201);

    await register('juanperez@empresa.com').expect(201);
    await register('juan.perez+ventas@empresa.com').expect(201);

    expect(await savedEmails()).toHaveLength(3);
  });

  it('se puede entrar escribiendo el email con otras mayúsculas', async () => {
    await register('ana@mail.com').expect(201);

    const res = await login('  ANA@Mail.com').expect(201);

    expect((res.body as { user: { email: string } }).user.email).toBe(
      'ana@mail.com',
    );
  });

  it('se puede entrar escribiendo el Gmail sin los puntos', async () => {
    await register('juan.perez@gmail.com').expect(201);

    const res = await login('juanperez@gmail.com').expect(201);

    expect((res.body as { user: { email: string } }).user.email).toBe(
      'juan.perez@gmail.com',
    );
  });

  it('"Olvidé mi contraseña" con el email en mayúsculas manda el link al email de la cuenta', async () => {
    await register('juan.perez@gmail.com').expect(201);

    await request(server())
      .post('/auth/forgot-password')
      .send({ email: 'JuanPerez@Gmail.com' })
      .expect(201);

    const [, job] = t.queues.mail.add.mock.calls.at(-1) as MailJob;
    expect(job.to).toBe('juan.perez@gmail.com');
  });

  it('la base no deja dos cuentas para el mismo buzón aunque se escriba directo en ella', async () => {
    const user = await createUser(t.prisma, { email: 'Juan.Perez@Gmail.com' });
    expect(user.email).toBe('juan.perez@gmail.com');

    await expect(
      createUser(t.prisma, { email: 'juanperez+np@googlemail.com' }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('si dos registros del mismo email pasan el control a la vez, uno se crea y el otro recibe 409', async () => {
    // Both requests find no account before either one is saved.
    const lookup = jest
      .spyOn(t.app.get(UserRepository), 'findByEmail')
      .mockResolvedValue(null);
    try {
      await register('ana@mail.com').expect(201);
      await register('Ana@Mail.com').expect(409);
    } finally {
      lookup.mockRestore();
    }

    expect(await savedEmails()).toEqual(['ana@mail.com']);
  });
});
