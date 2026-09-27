import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CaptchaService } from './captcha.service';

function captchaService(env: Record<string, unknown>) {
  const config = { get: (name: string) => env[name] };
  return new CaptchaService(config as unknown as ConfigService);
}

describe('CaptchaService', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('con el captcha desactivado aprueba sin consultar a Turnstile', async () => {
    const service = captchaService({ CAPTCHA_DISABLED: true });

    await expect(service.assertHuman(undefined)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin token rechaza sin consultar a Turnstile', async () => {
    const service = captchaService({
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
    });

    await expect(service.assertHuman(undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('valida el token contra Turnstile con la clave secreta', async () => {
    const service = captchaService({
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true })),
    );

    await expect(
      service.assertHuman('token-del-widget'),
    ).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      secret: 'turnstile-secret',
      response: 'token-del-widget',
    });
  });

  it('si Turnstile rechaza el token, rechaza el pedido', async () => {
    const service = captchaService({
      TURNSTILE_SECRET_KEY: 'turnstile-secret',
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false })),
    );

    await expect(service.assertHuman('token-vencido')).rejects.toThrow(
      BadRequestException,
    );
  });
});
