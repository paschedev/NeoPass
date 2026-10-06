// Doble de google-auth-library (moduleNameMapper en test/jest-e2e.json): ningún
// test llama a Google. Una credencial de prueba lleva lo que Google firmaría
// (la arma googleCredential en test/utils/google.ts) y se rechaza como lo haría
// Google si está adulterada, es para otra app o venció.
export const GOOGLE_TEST_PREFIX = 'google-test.';

export interface GoogleTestPayload {
  iss: string;
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  aud: string;
  iat: number;
  exp: number;
}

export const googleMock = {
  // Bajar las claves de Google; por defecto sale bien.
  loadKeys: jest.fn<Promise<unknown>, []>(),
};

function decode(idToken: string): GoogleTestPayload {
  if (!idToken.startsWith(GOOGLE_TEST_PREFIX)) {
    throw new Error('Invalid token signature');
  }
  try {
    return JSON.parse(
      Buffer.from(
        idToken.slice(GOOGLE_TEST_PREFIX.length),
        'base64url',
      ).toString(),
    ) as GoogleTestPayload;
  } catch {
    throw new Error('Invalid token signature');
  }
}

export class OAuth2Client {
  getFederatedSignonCertsAsync() {
    return googleMock.loadKeys();
  }

  verifyIdToken({ idToken, audience }: { idToken: string; audience: string }) {
    const payload = decode(idToken);
    if (payload.aud !== audience) {
      return Promise.reject(
        new Error('Wrong recipient, payload audience != requiredAudience'),
      );
    }
    if (payload.exp * 1000 < Date.now()) {
      return Promise.reject(new Error('Token used too late'));
    }
    return Promise.resolve({ getPayload: () => payload });
  }
}
