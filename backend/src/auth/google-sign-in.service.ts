import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  CURRENT_LEGAL_VERSIONS,
  legalDocumentsFor,
} from '../legal/legal-documents';
import { MailService } from '../mail/mail.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { AuthService } from './auth.service';
import {
  GoogleIdentity,
  GoogleIdentityService,
} from './google-identity.service';
import { UserRepository } from './repositories/user.repository';

// The front asks for the account's password when it sees this code.
export const GOOGLE_LINK_NEEDS_PASSWORD = 'GOOGLE_LINK_NEEDS_PASSWORD';
// And for the box "Soy mayor de 18 años y acepto…" when it sees this one.
export const GOOGLE_SIGN_UP_NEEDS_TERMS = 'GOOGLE_SIGN_UP_NEEDS_TERMS';

const LINKED_TO_ANOTHER_GOOGLE =
  'Esta cuenta ya está unida a otra cuenta de Google. Entrá con esa, o recuperá la cuenta con "Olvidé mi contraseña" para unir esta.';
const GOOGLE_IN_ANOTHER_ACCOUNT =
  'Esta cuenta de Google ya está unida a otra cuenta de NeoPass. Entrá con el email y la contraseña de esa cuenta.';

// The legal versions the person accepted in the sign-up box (the DTO only
// lets the versions in force in).
export type AcceptedLegal = { termsVersion?: number; privacyVersion?: number };

// "Continuar con Google". The email is the key of an account: Google only
// proves who controls it, so it never gives more access than "Olvidé mi
// contraseña" with that email, and the Google email has to be the account's
// email every time.
// An existing account enters straight away only when NeoPass already
// confirmed its email and Google owns that mailbox. Otherwise its password is
// asked once: whoever registered the email first, without confirming it,
// could still enter with their own password.
@Injectable()
export class GoogleSignInService {
  private readonly logger = new Logger(GoogleSignInService.name);

  constructor(
    private readonly googleIdentity: GoogleIdentityService,
    private readonly userRepository: UserRepository,
    private readonly authService: AuthService,
    private readonly mail: MailService,
  ) {}

  // Enters the account with that email, or creates a buyer account without
  // password once the person accepted the legal texts in force.
  async signIn(credential: string, accepted: AcceptedLegal = {}) {
    const google = await this.identify(credential);
    const account = await this.userRepository.findByEmail(google.email);
    if (account) return this.enterExisting(account, google);

    // It entered before with another email.
    if (await this.userRepository.findByGoogleId(google.sub)) {
      throw new ConflictException(GOOGLE_IN_ANOTHER_ACCOUNT);
    }
    if (
      accepted.termsVersion === undefined ||
      accepted.privacyVersion === undefined
    ) {
      // Nothing is saved until the person accepts.
      throw new ConflictException({
        code: GOOGLE_SIGN_UP_NEEDS_TERMS,
        message: 'Para crear tu cuenta, aceptá los términos.',
        email: google.email,
      });
    }
    try {
      const user = await this.userRepository.create({
        email: google.email,
        name: google.name,
        googleId: google.sub,
        emailVerifiedAt: new Date(),
        legalAcceptances: {
          create: legalDocumentsFor('CUSTOMER').map((document) => ({
            document,
            version: CURRENT_LEGAL_VERSIONS[document],
          })),
        },
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
    return this.authService.login(await this.linkGoogle(account, google));
  }

  // From an open session (the organizer's box after signing up, or
  // Configuración): the Google email has to be the account's.
  async connect(userId: string, credential: string) {
    const google = await this.identify(credential);
    const account = await this.findAccount(userId);
    if (account.googleId === google.sub) {
      return this.authService.getProfile(userId);
    }
    if (account.googleId) {
      throw new ConflictException('Ya tenés una cuenta de Google conectada.');
    }
    const owner = await this.userRepository.findByEmail(google.email);
    if (owner?.id !== account.id) {
      throw new BadRequestException(
        `Elegí la cuenta de Google de ${account.email}. Para usar otro correo, cambialo primero en Configuración.`,
      );
    }
    await this.assertCanLink(account, google);
    await this.linkGoogle(account, google);
    return this.authService.getProfile(userId);
  }

  // An account made with Google gets a password to enter with its email too.
  // A fresh Google credential confirms it: a copied session isn't enough.
  async createPassword(userId: string, credential: string, password: string) {
    const google = await this.identify(credential);
    const account = await this.findAccount(userId);
    if (account.passwordHash !== null) {
      throw new ConflictException(
        'Tu cuenta ya tiene contraseña. Podés cambiarla desde Configuración.',
      );
    }
    if (account.googleId !== google.sub) {
      throw new ForbiddenException(
        'Confirmá con la cuenta de Google conectada a NeoPass.',
      );
    }
    const hash = await bcrypt.hash(password, await bcrypt.genSalt());
    if (!(await this.userRepository.setPasswordIfNone(userId, hash))) {
      throw new ConflictException(
        'Tu cuenta ya tiene contraseña. Podés cambiarla desde Configuración.',
      );
    }
    return this.authService.getProfile(userId);
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

  private async findAccount(userId: string) {
    const account = await this.userRepository.findById(userId);
    if (!account) throw new UnauthorizedException();
    return account;
  }

  private async enterExisting(account: User, google: GoogleIdentity) {
    if (account.googleId === google.sub) return this.authService.login(account);
    await this.assertCanLink(account, google);
    if (account.emailVerifiedAt && google.ownsMailbox) {
      return this.authService.login(await this.linkGoogle(account, google));
    }
    throw new ConflictException({
      code: GOOGLE_LINK_NEEDS_PASSWORD,
      message:
        'Ya tenés una cuenta con este email. Ingresá tu contraseña para conectar Google.',
      email: account.email,
    });
  }

  private async assertCanLink(account: User, google: GoogleIdentity) {
    if (account.googleId) throw new ConflictException(LINKED_TO_ANOTHER_GOOGLE);
    if (await this.userRepository.findByGoogleId(google.sub)) {
      throw new ConflictException(GOOGLE_IN_ANOTHER_ACCOUNT);
    }
  }

  // Linking proves the mailbox, so the email ends up confirmed. The account's
  // email hears about it: a Google account that isn't yours shouldn't stay
  // linked unnoticed.
  private async linkGoogle(account: User, google: GoogleIdentity) {
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

    try {
      await this.mail.queueGoogleLinkedNotice({
        to: linked.email,
        name: linked.name,
      });
    } catch (error) {
      this.logger.error(
        `Could not queue the Google link notice of user ${linked.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return linked;
  }
}
