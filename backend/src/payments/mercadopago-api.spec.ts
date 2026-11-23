import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { AppConfig } from 'mercadopago/dist/utils/config';
import {
  blockExternalFetch,
  FakeApi,
  startFakeApi,
} from '../../test/utils/fake-api';
import type { NotificationsService } from '../notifications/notifications.service';
import type { ScheduledTurns } from '../redis/scheduled-turns';
import type { TicketsService } from '../tickets/tickets.service';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service';
import { PaymentsService } from './payments.service';
import type { PaymentsRepository } from './repositories/payments.repository';

const SELLER_TOKEN = 'APP_USR-organizer-token';
// Nothing listens there: a call the app didn't point anywhere fails at once.
const NOWHERE = 'http://127.0.0.1:9';

const sdkConfig = AppConfig as { BASE_URL: string };

function config(values: Record<string, string> = {}) {
  return new ConfigService({
    MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-platform-token',
    MERCADOPAGO_CLIENT_ID: 'client-id',
    MERCADOPAGO_CLIENT_SECRET: 'client-secret',
    FRONTEND_URL: 'https://app.neopass.test',
    BACKEND_URL: 'https://api.neopass.test',
    ...values,
  });
}

function paymentsService(appConfig: ConfigService) {
  return new PaymentsService(
    {} as PaymentsRepository,
    {} as TicketsService,
    appConfig,
    {} as Queue,
    {} as NotificationsService,
  );
}

function responseFor(path: string) {
  if (path.startsWith('/checkout/preferences')) {
    return { id: 'pref-1', init_point: 'https://mp.neopass.test/pref-1' };
  }
  if (path.startsWith('/oauth/token')) {
    return {
      access_token: 'APP_USR-new-token',
      refresh_token: 'TG-new-refresh',
      expires_in: 15_552_000,
      user_id: 123,
      public_key: 'APP_USR-public-key',
    };
  }
  return { id: 123, status: 'approved' };
}

describe('Mercado Pago simulado en las pruebas de carga', () => {
  let api: FakeApi;

  beforeAll(async () => {
    api = await startFakeApi(responseFor);
  });

  beforeEach(() => {
    api.received.length = 0;
    sdkConfig.BASE_URL = NOWHERE;
    blockExternalFetch();
  });

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => api.close());

  it('con MERCADOPAGO_API_URL, la preferencia y la consulta de un pago van a esa API con el token del organizador', async () => {
    const payments = paymentsService(config({ MERCADOPAGO_API_URL: api.url }));

    await payments.createPreference(
      'order-1',
      [{ id: 'tt-1', title: 'General', quantity: 1, unit_price: 1000 }],
      100,
      SELLER_TOKEN,
    );
    await new Payment(new MercadoPagoConfig({ accessToken: SELLER_TOKEN })).get(
      { id: '123' },
    );

    expect(api.received.map(({ method, path }) => `${method} ${path}`)).toEqual(
      ['POST /checkout/preferences/', 'GET /v1/payments/123'],
    );
    expect(api.received.map(({ authorization }) => authorization)).toEqual([
      `Bearer ${SELLER_TOKEN}`,
      `Bearer ${SELLER_TOKEN}`,
    ]);
  });

  it('con MERCADOPAGO_API_URL, vincular la cuenta canjea el código en esa API', async () => {
    const saveCredentials = jest.fn();
    const oauth = new MercadoPagoOAuthService(
      {
        updateUserMercadoPagoCredentials: saveCredentials,
      } as unknown as PaymentsRepository,
      config({ MERCADOPAGO_API_URL: api.url }),
      {} as ScheduledTurns,
    );

    await oauth.exchangeCode('organizer-1', 'authorization-code');

    expect(api.received).toEqual([
      expect.objectContaining({ method: 'POST', path: '/oauth/token' }),
    ]);
    expect(saveCredentials).toHaveBeenCalledWith(
      'organizer-1',
      expect.objectContaining({ mercadoPagoAccessToken: 'APP_USR-new-token' }),
    );
  });

  it('sin MERCADOPAGO_API_URL, el SDK apunta a la API real de Mercado Pago', () => {
    paymentsService(config());

    expect(sdkConfig.BASE_URL).toBe('https://api.mercadopago.com');
  });
});
