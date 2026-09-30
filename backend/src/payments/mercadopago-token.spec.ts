import {
  hasUsableMercadoPagoToken,
  toMercadoPagoCredentials,
} from './mercadopago-token';

const now = new Date('2026-10-01T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;

describe('hasUsableMercadoPagoToken', () => {
  it('un token vigente se puede usar', () => {
    expect(
      hasUsableMercadoPagoToken(
        {
          mercadoPagoAccessToken: 'APP_USR-token',
          mercadoPagoTokenExpiresAt: new Date(now.getTime() + DAY_MS),
        },
        now,
      ),
    ).toBe(true);
  });

  it('un token vencido no se puede usar', () => {
    expect(
      hasUsableMercadoPagoToken(
        {
          mercadoPagoAccessToken: 'APP_USR-token',
          mercadoPagoTokenExpiresAt: new Date(now.getTime() - 1),
        },
        now,
      ),
    ).toBe(false);
  });

  it('un token vinculado antes de guardar su vencimiento se sigue usando', () => {
    expect(
      hasUsableMercadoPagoToken(
        {
          mercadoPagoAccessToken: 'APP_USR-token',
          mercadoPagoTokenExpiresAt: null,
        },
        now,
      ),
    ).toBe(true);
  });

  it('sin token no hay con qué cobrar', () => {
    expect(
      hasUsableMercadoPagoToken(
        { mercadoPagoAccessToken: null, mercadoPagoTokenExpiresAt: null },
        now,
      ),
    ).toBe(false);
  });
});

describe('toMercadoPagoCredentials', () => {
  it('guarda el token, el refresh token y el vencimiento que informa Mercado Pago', () => {
    expect(
      toMercadoPagoCredentials(
        {
          access_token: 'APP_USR-token',
          refresh_token: 'TG-refresh',
          expires_in: 15_552_000,
          public_key: 'APP_USR-public',
          user_id: 123456,
        },
        now,
      ),
    ).toEqual({
      mercadoPagoAccessToken: 'APP_USR-token',
      mercadoPagoRefreshToken: 'TG-refresh',
      mercadoPagoTokenExpiresAt: new Date(now.getTime() + 180 * DAY_MS),
      mercadoPagoPublicKey: 'APP_USR-public',
      mercadoPagoUserId: '123456',
    });
  });

  it('sin refresh token ni vencimiento los deja vacíos', () => {
    expect(
      toMercadoPagoCredentials({ access_token: 'APP_USR-token' }, now),
    ).toEqual({
      mercadoPagoAccessToken: 'APP_USR-token',
      mercadoPagoRefreshToken: null,
      mercadoPagoTokenExpiresAt: null,
      mercadoPagoPublicKey: undefined,
      mercadoPagoUserId: undefined,
    });
  });
});
