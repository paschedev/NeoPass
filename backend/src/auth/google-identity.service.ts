import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { TokenPayload } from 'google-auth-library';

export interface GoogleIdentity {
  // Google's ID of the account: it never changes, the email can.
  sub: string;
  email: string;
  emailVerified: boolean;
  // Google owns the mailbox (Gmail or a Google Workspace domain), so whoever
  // holds this Google account holds the mailbox. Any other email was only
  // verified by Google once, when the account was made.
  ownsMailbox: boolean;
  name: string;
}

// Enough to tap the button and, if asked, type the password to link accounts.
const MAX_CREDENTIAL_AGE_SECONDS = 10 * 60;

const INVALID_CREDENTIAL =
  'No pudimos verificar tu cuenta de Google. Probá de nuevo.';

export const GOOGLE_UNAVAILABLE = 'Entrar con Google no está disponible.';

function displayName(payload: TokenPayload, email: string) {
  const fullName = [payload.given_name, payload.family_name]
    .filter(Boolean)
    .join(' ');
  return payload.name?.trim() || fullName.trim() || email.split('@')[0];
}

function ownsMailbox(payload: TokenPayload, email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  return domain === 'gmail.com' || (!!payload.hd && payload.hd === domain);
}

// The Google side of "Continuar con Google": who a credential of the button
// belongs to, once Google's signature, recipient and expiry are checked.
@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();
  private readonly clientId: string | null;
  private readonly logger = new Logger(GoogleIdentityService.name);

  constructor(config: ConfigService) {
    // An on/off switch, not a setting with a default: without the client ID
    // (until Google's console is ready) the API runs and Google stays off.
    this.clientId = config.get<string>('GOOGLE_CLIENT_ID') || null;
  }

  // Only credentials Google signed for NeoPass a few minutes ago.
  async verify(credential: string): Promise<GoogleIdentity> {
    if (!this.clientId)
      throw new ServiceUnavailableException(GOOGLE_UNAVAILABLE);
    await this.loadGoogleKeys();
    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      // Wrong signature, recipient or expiry: the keys were already loaded,
      // so the problem is the credential.
      throw new UnauthorizedException(INVALID_CREDENTIAL);
    }
    const ageSeconds = payload ? Date.now() / 1000 - payload.iat : Infinity;
    if (!payload?.email || ageSeconds > MAX_CREDENTIAL_AGE_SECONDS) {
      throw new UnauthorizedException(INVALID_CREDENTIAL);
    }
    return {
      sub: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified === true,
      ownsMailbox: ownsMailbox(payload, payload.email),
      name: displayName(payload, payload.email),
    };
  }

  // The client keeps Google's signing keys until they expire. Not reaching
  // Google is our problem, not the user's credential.
  private async loadGoogleKeys() {
    try {
      await this.client.getFederatedSignonCertsAsync();
    } catch (error) {
      this.logger.error(
        'Could not load the Google sign-in keys',
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'No pudimos conectarnos con Google. Probá de nuevo en un rato.',
      );
    }
  }
}
