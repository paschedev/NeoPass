import request from 'supertest';
import { CURRENT_LEGAL_VERSIONS } from '../src/legal/legal-documents';
import { ACCEPTED_LEGAL, ACCEPTED_ORGANIZER_LEGAL } from './utils/legal';
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
  ...ACCEPTED_LEGAL,
};

const ORGANIZER = {
  ...CUSTOMER,
  email: 'productora@neopass.test',
  role: 'ORGANIZER',
  phone: '+541123456789',
  companyName: 'Productora',
  ...ACCEPTED_ORGANIZER_LEGAL,
};

const TERMS_MESSAGE =
  'Aceptá la versión vigente de los Términos de uso y la Política de privacidad';
const ORGANIZER_TERMS_MESSAGE =
  'Aceptá la versión vigente de los Términos para organizadores';

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

  it('el nombre y el apellido tienen hasta 30 caracteres y la productora hasta 50', async () => {
    const messages = [];
    for (const tooLong of [
      { firstName: 'A'.repeat(31) },
      { lastName: 'P'.repeat(31) },
      { companyName: 'C'.repeat(51) },
    ]) {
      const res = await register({ ...ORGANIZER, ...tooLong }).expect(400);
      messages.push((res.body as { message: string[] }).message);
    }

    expect(messages).toEqual([
      ['El nombre puede tener hasta 30 caracteres'],
      ['El apellido puede tener hasta 30 caracteres'],
      ['El nombre de la productora puede tener hasta 50 caracteres'],
    ]);
    expect(await t.prisma.user.count()).toBe(0);
  });

  it('nadie se registra con "NeoPass" en su nombre o en el de su productora', async () => {
    for (const branded of [
      { firstName: 'NeoPass' },
      { lastName: 'Neo Pass' },
      { companyName: 'Soporte NEOPASS' },
    ]) {
      const res = await register({ ...ORGANIZER, ...branded }).expect(400);
      expect((res.body as { message: string[] }).message).toEqual([
        'El nombre no puede incluir "NeoPass"',
      ]);
    }

    expect(await t.prisma.user.count()).toBe(0);
  });

  describe('Términos y privacidad', () => {
    const acceptances = () =>
      t.prisma.legalAcceptance.findMany({
        orderBy: { document: 'asc' },
        select: { document: true, version: true, acceptedAt: true },
      });

    it('quien no acepta los Términos de uso y la Política de privacidad no crea su cuenta', async () => {
      const res = await register({
        ...CUSTOMER,
        termsVersion: undefined,
        privacyVersion: undefined,
      }).expect(400);

      expect((res.body as { message: string[] }).message).toEqual([
        TERMS_MESSAGE,
      ]);
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('una versión vieja de los términos o de la privacidad se rechaza', async () => {
      for (const old of [
        { termsVersion: CURRENT_LEGAL_VERSIONS.TERMS - 1 },
        { privacyVersion: CURRENT_LEGAL_VERSIONS.PRIVACY - 1 },
        { termsVersion: String(CURRENT_LEGAL_VERSIONS.TERMS) },
      ]) {
        const res = await register({ ...CUSTOMER, ...old }).expect(400);
        expect((res.body as { message: string[] }).message).toEqual([
          TERMS_MESSAGE,
        ]);
      }

      expect(await t.prisma.user.count()).toBe(0);
      expect(await t.prisma.legalAcceptance.count()).toBe(0);
    });

    it('un cliente queda con los Términos de uso y la Política de privacidad vigentes y su fecha, y nada de organizadores aunque lo mande', async () => {
      const before = new Date();

      await register({
        ...CUSTOMER,
        organizerTermsVersion: CURRENT_LEGAL_VERSIONS.ORGANIZER_TERMS,
      }).expect(201);

      const rows = await acceptances();
      expect(rows.map(({ document, version }) => [document, version])).toEqual([
        ['TERMS', CURRENT_LEGAL_VERSIONS.TERMS],
        ['PRIVACY', CURRENT_LEGAL_VERSIONS.PRIVACY],
      ]);
      for (const { acceptedAt } of rows) {
        expect(acceptedAt.getTime()).toBeGreaterThanOrEqual(
          before.getTime() - 1000,
        );
        expect(acceptedAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      }
    });

    it('un organizador que no acepta los Términos para organizadores no crea su cuenta', async () => {
      for (const organizerTermsVersion of [
        undefined,
        CURRENT_LEGAL_VERSIONS.ORGANIZER_TERMS - 1,
      ]) {
        const res = await register({
          ...ORGANIZER,
          organizerTermsVersion,
        }).expect(400);
        expect((res.body as { message: string[] }).message).toEqual([
          ORGANIZER_TERMS_MESSAGE,
        ]);
      }

      expect(await t.prisma.user.count()).toBe(0);
    });

    it('un organizador queda con los tres textos vigentes', async () => {
      await register(ORGANIZER).expect(201);

      const user = await t.prisma.user.findUniqueOrThrow({
        where: { email: ORGANIZER.email },
        select: { legalAcceptances: { select: { document: true } } },
      });
      expect(
        (await acceptances()).map(({ document, version }) => [
          document,
          version,
        ]),
      ).toEqual([
        ['TERMS', CURRENT_LEGAL_VERSIONS.TERMS],
        ['PRIVACY', CURRENT_LEGAL_VERSIONS.PRIVACY],
        ['ORGANIZER_TERMS', CURRENT_LEGAL_VERSIONS.ORGANIZER_TERMS],
      ]);
      expect(user.legalAcceptances).toHaveLength(3);
    });
  });
});
