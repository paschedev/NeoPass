import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  afterSignInPath,
  googleSignInStep,
  isGoogleEnabled,
  isInAppBrowser,
  readLastLoginMethod,
  rememberLoginMethod,
} from './google-sign-in';

const buyer = { role: 'CUSTOMER' as const };
const organizer = { role: 'ORGANIZER' as const };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('isGoogleEnabled', () => {
  it('sin el client ID no hay Google', () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '');
    expect(isGoogleEnabled()).toBe(false);
  });

  it('con el client ID, sí', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      'neopass.apps.googleusercontent.com',
    );
    expect(isGoogleEnabled()).toBe(true);
  });
});

describe('isInAppBrowser', () => {
  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0',
    'Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/450.0;]',
    'Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]',
    'Mozilla/5.0 (Linux; Android 14) musical_ly_2023 TikTok',
  ])('reconoce el navegador de una app: %s', (userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(true);
  });

  it.each([
    'Mozilla/5.0 (Linux; Android 14) Chrome/130.0 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
  ])('Chrome y Safari no lo son: %s', (userAgent) => {
    expect(isInAppBrowser(userAgent)).toBe(false);
  });
});

describe('googleSignInStep', () => {
  it('sin cuenta, pide aceptar los términos', () => {
    expect(
      googleSignInStep({
        code: 'GOOGLE_SIGN_UP_NEEDS_TERMS',
        email: 'ana@gmail.com',
      }),
    ).toEqual({ kind: 'terms', email: 'ana@gmail.com' });
  });

  it('con una cuenta sin Google, pide la contraseña', () => {
    expect(
      googleSignInStep({
        code: 'GOOGLE_LINK_NEEDS_PASSWORD',
        email: 'ana@gmail.com',
      }),
    ).toEqual({ kind: 'password', email: 'ana@gmail.com' });
  });

  it('cualquier otro error no es un paso', () => {
    expect(googleSignInStep({ message: 'Error' })).toBeNull();
    expect(googleSignInStep(null)).toBeNull();
  });
});

describe('afterSignInPath', () => {
  it('vuelve a la página que pidió entrar', () => {
    expect(afterSignInPath('?callbackUrl=%2Feventos%2F1', buyer)).toBe(
      '/eventos/1',
    );
  });

  it('nunca a otro sitio', () => {
    expect(afterSignInPath('?callbackUrl=https%3A%2F%2Fmalo.com', buyer)).toBe(
      '/panel/tickets',
    );
  });

  it('sin página pedida, va al inicio de cada uno', () => {
    expect(afterSignInPath('', buyer)).toBe('/panel/tickets');
    expect(afterSignInPath('', organizer)).toBe('/panel');
  });
});

describe('último método usado', () => {
  it('recuerda cómo entró', () => {
    rememberLoginMethod('google');
    expect(readLastLoginMethod()).toBe('google');
    rememberLoginMethod('password');
    expect(readLastLoginMethod()).toBe('password');
  });

  it('sin nada guardado, o con algo raro, no hay último', () => {
    expect(readLastLoginMethod()).toBeNull();
    localStorage.setItem('lastLoginMethod', 'otro');
    expect(readLastLoginMethod()).toBeNull();
  });

  it('sin almacenamiento no falla', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => rememberLoginMethod('google')).not.toThrow();
    expect(readLastLoginMethod()).toBeNull();
  });
});
