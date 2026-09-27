import request from 'supertest';
import { mockTurnstile } from './utils/network';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const CUSTOMER = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana@neopass.test',
  password: 'Password123',
  role: 'CUSTOMER',
  captchaToken: 'captcha-de-prueba',
};

const ORGANIZER = {
  ...CUSTOMER,
  email: 'productora@neopass.test',
  role: 'ORGANIZER',
  phone: '+541123456789',
  companyName: 'Productora',
};

describe('Registro', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(async () => {
    await resetDb(t.prisma);
    mockTurnstile(true);
  });

  afterAll(() => t.close());

  function register(body: Record<string, unknown>) {
    return request(t.app.getHttpServer()).post('/auth/register').send(body);
  }

  it('un cliente se registra sin teléfono', async () => {
    await register(CUSTOMER).expect(201);

    const user = await t.prisma.user.findUniqueOrThrow({
      where: { email: CUSTOMER.email },
    });
    expect(user.role).toBe('CUSTOMER');
  });

  it('un organizador con teléfono en formato internacional se registra', async () => {
    await register(ORGANIZER).expect(201);

    const user = await t.prisma.user.findUniqueOrThrow({
      where: { email: ORGANIZER.email },
      include: { organizerProfile: true },
    });
    expect(user.role).toBe('ORGANIZER');
    expect(user.organizerProfile?.phone).toBe('+541123456789');
  });

  it('nadie puede registrarse como ADMIN', async () => {
    await register({ ...CUSTOMER, role: 'ADMIN' }).expect(400);

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('un email inválido se rechaza', async () => {
    await register({ ...CUSTOMER, email: 'no-es-un-email' }).expect(400);

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('la contraseña necesita al menos 8 caracteres', async () => {
    await register({ ...CUSTOMER, password: 'Pass123' }).expect(400);

    expect(await t.prisma.user.count()).toBe(0);
  });

  it('el teléfono del organizador tiene que venir sin espacios ni guiones', async () => {
    await register({ ...ORGANIZER, phone: '+54 11 2345-6789' }).expect(400);

    expect(await t.prisma.user.count()).toBe(0);
  });
});
