import { validateEnv } from './env.validation';

const PRODUCTION_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:password@db.neopass.test:5432/neopass',
  JWT_SECRET: 'jwt-secret',
  FRONTEND_URL: 'https://neopass.ar',
  BACKEND_URL: 'https://api.neopass.ar',
  REDIS_URL: 'redis://default:password@redis.neopass.test:6379',
  MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-platform-token',
  MERCADOPAGO_CLIENT_ID: 'mp-client-id',
  MERCADOPAGO_CLIENT_SECRET: 'mp-client-secret',
  MERCADOPAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
  RESEND_API_KEY: 're_resend_key',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  CLOUDINARY_URL: 'cloudinary://key:secret@neopass',
};

const REQUIRED_VARIABLES = Object.keys(PRODUCTION_ENV).filter(
  (name) => name !== 'NODE_ENV',
);

function without(name: string) {
  const env: Record<string, string> = { ...PRODUCTION_ENV };
  delete env[name];
  return env;
}

describe('validateEnv', () => {
  it('con todas las variables de producción la configuración es válida', () => {
    expect(() => validateEnv(PRODUCTION_ENV)).not.toThrow();
  });

  it.each(REQUIRED_VARIABLES)('la app no arranca sin %s', (name) => {
    expect(() => validateEnv(without(name))).toThrow(name);
  });

  it('una variable vacía cuenta como faltante', () => {
    expect(() => validateEnv({ ...PRODUCTION_ENV, JWT_SECRET: '' })).toThrow(
      'JWT_SECRET',
    );
  });

  it('las URLs del front y del back tienen que ser http(s)', () => {
    expect(() =>
      validateEnv({ ...PRODUCTION_ENV, BACKEND_URL: 'api.neopass.ar' }),
    ).toThrow('BACKEND_URL');
  });

  it('el error nombra las variables inválidas sin mostrar sus valores', () => {
    let message = '';
    try {
      validateEnv({ ...PRODUCTION_ENV, FRONTEND_URL: 'valor-secreto' });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('FRONTEND_URL');
    expect(message).not.toContain('valor-secreto');
  });

  it('en producción no se puede desactivar el captcha', () => {
    expect(() =>
      validateEnv({ ...PRODUCTION_ENV, CAPTCHA_DISABLED: 'true' }),
    ).toThrow('CAPTCHA_DISABLED');
  });

  it('fuera de producción el captcha desactivado no necesita la clave de Turnstile', () => {
    const env = {
      ...without('TURNSTILE_SECRET_KEY'),
      NODE_ENV: 'development',
      CAPTCHA_DISABLED: 'true',
    };

    expect(validateEnv(env).CAPTCHA_DISABLED).toBe(true);
  });

  it('CAPTCHA_DISABLED=false no desactiva el captcha', () => {
    expect(
      validateEnv({ ...PRODUCTION_ENV, CAPTCHA_DISABLED: 'false' })
        .CAPTCHA_DISABLED,
    ).toBe(false);
  });
});
