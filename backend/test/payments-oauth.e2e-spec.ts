import request from 'supertest';
import { testEnv } from './setup/test-env';
import { authHeader } from './utils/auth';
import { createUser } from './utils/factories';
import { createTestApp, TestApp } from './utils/test-app';
import { resetDb } from './utils/test-database';

describe('Vinculación de Mercado Pago por OAuth', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  beforeEach(() => resetDb(t.prisma));

  afterAll(() => t.close());

  async function savedToken(userId: string) {
    const user = await t.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return user.mercadoPagoAccessToken;
  }

  it('el callback vincula la cuenta con el state que entregó el link', async () => {
    const organizer = await createUser(t.prisma, { role: 'ORGANIZER' });
    const link = await request(t.app.getHttpServer())
      .get('/payments/oauth/link')
      .set('Authorization', authHeader(t.app, organizer))
      .expect(200);
    const state = new URL((link.body as { url: string }).url).searchParams.get(
      'state',
    );
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'APP_USR-organizer-token',
          public_key: 'APP_USR-public-key',
          user_id: 123456,
        }),
      ),
    );

    const res = await request(t.app.getHttpServer())
      .get('/payments/oauth/callback')
      .query({ code: 'codigo-de-mp', state })
      .expect(302);

    expect(res.headers.location).toBe(
      `${testEnv.FRONTEND_URL}/panel?mp_success=true`,
    );
    expect(await savedToken(organizer.id)).toBe('APP_USR-organizer-token');
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
    expect(await savedToken(organizer.id)).toBeNull();
  });
});
