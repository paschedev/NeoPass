import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import {
  blockExternalFetch,
  FakeApi,
  startFakeApi,
} from '../../test/utils/fake-api';
import { MailService } from './mail.service';

describe('Resend simulado en las pruebas de carga', () => {
  let api: FakeApi;

  beforeAll(async () => {
    api = await startFakeApi(() => ({ id: 'email-1' }));
  });

  beforeEach(() => blockExternalFetch());

  afterEach(() => jest.restoreAllMocks());

  afterAll(() => api.close());

  it('con RESEND_BASE_URL, el mail sale hacia esa API con la clave de Resend', async () => {
    const mail = new MailService(
      new ConfigService({
        RESEND_API_KEY: 're_test_key',
        FRONTEND_URL: 'https://app.neopass.test',
        RESEND_BASE_URL: api.url,
      }),
      {} as Queue,
    );

    await mail.sendEmailCode({
      to: 'ana@neopass.test',
      name: 'Ana',
      code: '123456',
      purpose: 'VERIFY',
    });

    expect(api.received).toEqual([
      expect.objectContaining({
        method: 'POST',
        path: '/emails',
        authorization: 'Bearer re_test_key',
      }),
    ]);
  });
});
