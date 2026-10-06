import { randomUUID } from 'crypto';
import {
  GOOGLE_TEST_PREFIX,
  GoogleTestPayload,
} from '../mocks/google-auth-library';
import { testEnv } from '../setup/test-env';

// Credencial del botón "Continuar con Google" como la firmaría Google para
// NeoPass, recién emitida y con el email verificado salvo que se diga otra cosa.
export function googleCredential({
  sub = `google-${randomUUID()}`,
  email,
  emailVerified = true,
  name = 'Ana Gómez',
  issuedMinutesAgo = 0,
  audience = testEnv.GOOGLE_CLIENT_ID,
}: {
  sub?: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  issuedMinutesAgo?: number;
  audience?: string;
}) {
  const iat = Math.floor(Date.now() / 1000) - issuedMinutesAgo * 60;
  const payload: GoogleTestPayload = {
    iss: 'https://accounts.google.com',
    sub,
    email,
    email_verified: emailVerified,
    name,
    aud: audience,
    iat,
    exp: iat + 60 * 60,
  };
  return `${GOOGLE_TEST_PREFIX}${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
}

// Una credencial con la firma rota.
export const TAMPERED_GOOGLE_CREDENTIAL = `${GOOGLE_TEST_PREFIX}adulterada`;
