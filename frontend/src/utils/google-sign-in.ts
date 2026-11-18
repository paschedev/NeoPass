import { getSafeRedirect } from './redirect';
import { getHomePath } from './navigation';
import type { RoleFlags } from './roles';

// "Continuar con Google": lo que no depende del script de Google.

// Sin el client ID (hasta configurar Google) no aparece ningún botón.
export function getGoogleClientId(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
}

export function isGoogleEnabled(): boolean {
  return getGoogleClientId() !== '';
}

// Instagram, Facebook y TikTok abren los links en su propio navegador, donde
// Google no deja entrar: ahí va un aviso en lugar del botón.
const IN_APP_BROWSER =
  /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|Bytedance/i;

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_BROWSER.test(userAgent);
}

// Lo que pide el back antes de entrar o crear la cuenta.
export type GoogleSignInStep =
  | { kind: 'terms'; email: string }
  | { kind: 'password'; email: string };

export function googleSignInStep(body: unknown): GoogleSignInStep | null {
  if (!body || typeof body !== 'object') return null;
  const { code, email } = body as { code?: unknown; email?: unknown };
  if (typeof email !== 'string') return null;
  if (code === 'GOOGLE_SIGN_UP_NEEDS_TERMS') return { kind: 'terms', email };
  if (code === 'GOOGLE_LINK_NEEDS_PASSWORD') return { kind: 'password', email };
  return null;
}

// Adónde va después de entrar: la página que pidió entrar, si es de NeoPass,
// o su inicio.
export function afterSignInPath(search: string, user: RoleFlags): string {
  const callbackUrl = getSafeRedirect(
    new URLSearchParams(search).get('callbackUrl'),
  );
  return callbackUrl ?? getHomePath(user);
}

// "Último usado" en Ingresar, como recuerdo de este navegador.
export type LoginMethod = 'google' | 'password';

const LAST_LOGIN_METHOD = 'lastLoginMethod';

export function readLastLoginMethod(): LoginMethod | null {
  try {
    const value = localStorage.getItem(LAST_LOGIN_METHOD);
    return value === 'google' || value === 'password' ? value : null;
  } catch {
    return null;
  }
}

export function rememberLoginMethod(method: LoginMethod): void {
  try {
    localStorage.setItem(LAST_LOGIN_METHOD, method);
  } catch {
    // Sin almacenamiento (modo privado): no se recuerda y listo.
  }
}
