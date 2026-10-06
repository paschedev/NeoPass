import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { AuthService } from './auth.service';
import {
  GoogleIdentity,
  GoogleIdentityService,
} from './google-identity.service';
import { UserRepository } from './repositories/user.repository';

// The front asks for the account's password when it sees this code.
export const GOOGLE_LINK_NEEDS_PASSWORD = 'GOOGLE_LINK_NEEDS_PASSWORD';

const LINKED_TO_ANOTHER_GOOGLE =
  'Esta cuenta ya está unida a otra cuenta de Google. Entrá con esa, o recuperá la cuenta con "Olvidé mi contraseña" para unir esta.';
const GOOGLE_IN_ANOTHER_ACCOUNT =
  'Esta cuenta de Google ya está unida a otra cuenta de NeoPass. Entrá con el email y la contraseña de esa cuenta.';

// "Continuar con Google". The email is the key of an account: Google only
// proves who controls it, so it never gives more access than "Olvidé mi
// contraseña" with that email. An existing account is linked only with its
// password, and the Google email has to be the account's email every time.
@Injectable()
export class GoogleSignInService {
  constructor(
    private readonly googleIdentity: GoogleIdentityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
  ) {}

  // Enters the linked account, or creates a buyer account without password
  // when there is none for that email.
  async signIn(credential: string) {
    const google = await this.identify(credential);
    const account = await this.userRepository.findByEmail(google.email);
    if (account) return this.enterExisting(account, google);

    // It entered before with another email.
    if (await this.userRepository.findByGoogleId(google.sub)) {
      throw new ConflictException(GOOGLE_IN_ANOTHER_ACCOUNT);
    }
    try {
      const user = await this.userRepository.create({
        email: google.email,
        name: google.name,
        googleId: google.sub,
        emailVerifiedAt: new Date(),
      });
      return await this.authService.login(user);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Another request for the same email (a double tap) was saved first.
      const saved = await this.userRepository.findByEmail(google.email);
      if (!saved) throw error;
      return this.enterExisting(saved, google);
    }
  }

  // With the account's password: from then on, Google is enough.
  async link(credential: string, password: string) {
    const google = await this.identify(credential);
    const account = await this.userRepository.findByEmail(google.email);
    if (!account) {
      throw new NotFoundException('No hay una cuenta con este email para unir');
    }
    if (account.googleId === google.sub) return this.authService.login(account);
    await this.assertCanLink(account, google);

    const validPassword =
      account.passwordHash !== null &&
      (await bcrypt.compare(password, account.passwordHash));
    if (!validPassword) {
      throw new UnauthorizedException('La contraseña es incorrecta');
    }

    let linked: User | null;
    try {
      linked = await this.userRepository.linkGoogle(
        account.id,
        google.sub,
        account.emailVerifiedAt ?? new Date(),
      );
    } catch (error) {
      // The same Google account was linked to another account in between.
      if (isUniqueViolation(error)) {
        throw new ConflictException(GOOGLE_IN_ANOTHER_ACCOUNT);
      }
      throw error;
    }
    // Another Google account was linked to this one in between.
    if (!linked) throw new ConflictException(LINKED_TO_ANOTHER_GOOGLE);
    return this.authService.login(linked);
  }

  private async identify(credential: string) {
    const google = await this.googleIdentity.verify(credential);
    if (!google.emailVerified) {
      throw new ForbiddenException(
        'Tu cuenta de Google no tiene el email verificado. Verificalo en Google o registrate con tu email y una contraseña.',
      );
    }
    return google;
  }

  private async enterExisting(account: User, google: GoogleIdentity) {
    if (account.googleId === google.sub) return this.authService.login(account);
    await this.assertCanLink(account, google);
    throw new ConflictException({
      code: GOOGLE_LINK_NEEDS_PASSWORD,
      message:
        'Ya tenés una cuenta con este email. Ingresá tu contraseña para unir Google.',
    });
  }

  private async assertCanLink(account: User, google: GoogleIdentity) {
    if (account.googleId) throw new ConflictException(LINKED_TO_ANOTHER_GOOGLE);
    if (await this.userRepository.findByGoogleId(google.sub)) {
      throw new ConflictException(GOOGLE_IN_ANOTHER_ACCOUNT);
    }
  }
}
