import request from 'supertest';
import { Prisma } from '@prisma/client';
import { MercadoPagoOAuthService } from '../src/payments/mercadopago-oauth.service';
import { testEnv } from './setup/test-env';
import { authHeader } from './utils/auth';
import { createUser, mercadoPagoTokenCipher } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

const DAY_MS = 24 * 60 * 60 * 1000;
// Lo que dura un token de Mercado Pago: 180 días, en segundos.
const TOKEN_TTL_S = 15_552_000;
const CALLBACK_URL = `${testEnv.BACKEND_URL}/payments/oauth/callback`;

// Respuesta de POST /oauth/token de Mercado Pago (canje del código o renovación).
function mockMercadoPagoToken(body: Record<string, unknown>, status = 200) {
  jest
    .mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
}

// Formulario que la app le mandó a Mercado Pago en la llamada número `call`
// (la app lo manda como texto x-www-form-urlencoded).
function sentForm(call = 0) {
  const [, init] = jest.mocked(fetch).mock.calls[call];
  return new URLSearchParams(init?.body as string);
}

describe('Vinculación de Mercado Pago por OAuth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  function findUser(userId: string) {
    return t.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  // Lo que quedó guardado en la base, descifrado.
  function readable(stored: string | null) {
    return stored === null ? null : mercadoPagoTokenCipher.decrypt(stored);
  }

  // Organizador vinculado: en la base los tokens están cifrados.
  function linkedOrganizer({
    refreshToken,
    ...data
  }: Partial<Prisma.UserCreateInput> & { refreshToken?: string } = {}) {
    return createUser(t.prisma, {
      role: 'ORGANIZER',
      mercadoPagoAccessToken: mercadoPagoTokenCipher.encrypt(
        'APP_USR-current-token',
      ),
      mercadoPagoRefreshToken:
        refreshToken && mercadoPagoTokenCipher.encrypt(refreshToken),
      ...data,
    });
  }

  async function authorizationLink(
    organizer: Parameters<typeof authHeader>[1],
  ) {
    const link = await request(t.app.getHttpServer())
      .get('/payments/oauth/link')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);
    return (link.body as { url: string }).url;
  }

  it('el link de autorización manda el redirect_uri codificado', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });

    const url = await authorizationLink(organizer);

    expect(url).toContain(`redirect_uri=${encodeURIComponent(CALLBACK_URL)}`);
    expect(new URL(url).searchParams.get('redirect_uri')).toBe(CALLBACK_URL);
  });

  it('el callback vincula la cuenta y guarda cifrados el token y el refresh token, con el vencimiento', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });
    const state = new URL(await authorizationLink(organizer)).searchParams.get(
      'state',
    );
    mockMercadoPagoToken({
      access_token: 'APP_USR-organizer-token',
      public_key: 'APP_USR-public-key',
      user_id: 123456,
      refresh_token: 'TG-refresh-1',
      expires_in: TOKEN_TTL_S,
    });
    const before = Date.now();

    const res = await request(t.app.getHttpServer())
      .get('/payments/oauth/callback')
      .query({ code: 'codigo-de-mp', state })
      .expect(302);

    expect(res.headers.location).toBe(
      `${testEnv.FRONTEND_URL}/panel?mp_success=true`,
    );
    expect(sentForm().get('grant_type')).toBe('authorization_code');
    expect(sentForm().get('redirect_uri')).toBe(CALLBACK_URL);
    const user = await findUser(organizer.id);
    expect(user.mercadoPagoAccessToken).not.toContain(
      'APP_USR-organizer-token',
    );
    expect(user.mercadoPagoRefreshToken).not.toContain('TG-refresh-1');
    expect(readable(user.mercadoPagoAccessToken)).toBe(
      'APP_USR-organizer-token',
    );
    expect(readable(user.mercadoPagoRefreshToken)).toBe('TG-refresh-1');
    expect(user.mercadoPagoUserId).toBe('123456');
    const expiresAt = user.mercadoPagoTokenExpiresAt!.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(before + TOKEN_TTL_S * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + TOKEN_TTL_S * 1000);
  });

  it('el callback rechaza un token de sesión usado como state', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });
    const sessionToken = authHeader(t.app, organizer).replace('Bearer ', '');

    const res = await request(t.app.getHttpServer())
      .get('/payments/oauth/callback')
      .query({ code: 'codigo-de-mp', state: sessionToken })
      .expect(302);

    expect(res.headers.location).toBe(
      `${testEnv.FRONTEND_URL}/panel?mp_error=true`,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect((await findUser(organizer.id)).mercadoPagoAccessToken).toBeNull();
  });

  it('con el token vencido, el organizador figura sin Mercado Pago vinculado', async () => {
    const organizer = await linkedOrganizer({
      mercadoPagoTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    const res = await request(t.app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);

    expect((res.body as { hasLinkedMp: boolean }).hasLinkedMp).toBe(false);
  });

  describe('renovación diaria del token', () => {
    const now = new Date();
    const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS);
    const renew = () =>
      t.app.get(MercadoPagoOAuthService).refreshExpiringTokens(now);

    it('renueva los tokens que vencen en los próximos 30 días y guarda cifrado el refresh token nuevo', async () => {
      const organizer = await linkedOrganizer({
        refreshToken: 'TG-old',
        mercadoPagoTokenExpiresAt: inDays(10),
      });
      mockMercadoPagoToken({
        access_token: 'APP_USR-new-token',
        refresh_token: 'TG-new',
        expires_in: TOKEN_TTL_S,
        user_id: 123456,
      });

      await renew();

      const form = sentForm();
      expect(form.get('grant_type')).toBe('refresh_token');
      expect(form.get('refresh_token')).toBe('TG-old');
      expect(form.get('client_id')).toBe(testEnv.MERCADOPAGO_CLIENT_ID);
      expect(form.get('client_secret')).toBe(testEnv.MERCADOPAGO_CLIENT_SECRET);
      const user = await findUser(organizer.id);
      expect(user.mercadoPagoRefreshToken).not.toContain('TG-new');
      expect(readable(user.mercadoPagoAccessToken)).toBe('APP_USR-new-token');
      expect(readable(user.mercadoPagoRefreshToken)).toBe('TG-new');
      expect(user.mercadoPagoTokenExpiresAt).toEqual(
        new Date(now.getTime() + TOKEN_TTL_S * 1000),
      );
    });

    it('no toca los tokens que vencen más adelante ni los vinculados sin refresh token', async () => {
      await linkedOrganizer({
        refreshToken: 'TG-later',
        mercadoPagoTokenExpiresAt: inDays(60),
      });
      await linkedOrganizer();

      await renew();

      expect(fetch).not.toHaveBeenCalled();
    });

    it('si Mercado Pago rechaza una renovación, conserva ese token y sigue con los demás', async () => {
      const rejected = await linkedOrganizer({
        refreshToken: 'TG-revoked',
        mercadoPagoTokenExpiresAt: inDays(5),
      });
      const renewed = await linkedOrganizer({
        refreshToken: 'TG-valid',
        mercadoPagoTokenExpiresAt: inDays(6),
      });
      mockMercadoPagoToken({ message: 'invalid_grant' }, 400);
      mockMercadoPagoToken({
        access_token: 'APP_USR-renewed',
        refresh_token: 'TG-valid-2',
        expires_in: TOKEN_TTL_S,
      });

      await renew();

      const kept = await findUser(rejected.id);
      expect(readable(kept.mercadoPagoAccessToken)).toBe(
        'APP_USR-current-token',
      );
      expect(readable(kept.mercadoPagoRefreshToken)).toBe('TG-revoked');
      expect(
        readable((await findUser(renewed.id)).mercadoPagoAccessToken),
      ).toBe('APP_USR-renewed');
    });
  });

  describe('tokens guardados antes del cifrado', () => {
    const encryptLegacy = () =>
      t.app.get(MercadoPagoOAuthService).encryptPlaintextTokens();

    it('al arrancar, la app cifra los tokens que estaban en texto plano', async () => {
      const organizer = await createUser(t.prisma, {
        role: 'ORGANIZER',
        mercadoPagoAccessToken: 'APP_USR-legacy-token',
        mercadoPagoRefreshToken: 'TG-legacy',
      });

      await encryptLegacy();

      const user = await findUser(organizer.id);
      expect(user.mercadoPagoAccessToken).not.toContain('APP_USR-legacy-token');
      expect(readable(user.mercadoPagoAccessToken)).toBe(
        'APP_USR-legacy-token',
      );
      expect(readable(user.mercadoPagoRefreshToken)).toBe('TG-legacy');
    });

    it('los tokens ya cifrados y las cuentas sin vincular quedan como estaban', async () => {
      const linked = await linkedOrganizer({ refreshToken: 'TG-current' });
      const unlinked = await createUser(t.prisma, { role: 'ORGANIZER' });

      await encryptLegacy();

      expect(await findUser(linked.id)).toEqual(linked);
      expect(await findUser(unlinked.id)).toEqual(unlinked);
    });
  });
});
