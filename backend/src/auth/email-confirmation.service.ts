import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { EmailCode, EmailCodePurpose, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { maskEmail } from '../common/mask-email';
import { MailService } from '../mail/mail.service';
import { isUniqueViolation } from '../prisma/prisma-errors';
import {
  codeRequestError,
  EMAIL_CODE_ATTEMPTS,
  EMAIL_CODE_TTL_MS,
  generateEmailCode,
  nextSendWindow,
  wrongCodeMessage,
} from './email-code';
import {
  EmailCodeRepository,
  NewEmailCode,
} from './repositories/email-code.repository';
import { UserRepository } from './repositories/user.repository';

const EMAIL_IN_USE = 'Ese correo ya tiene una cuenta en NeoPass';
const CODE_USED = 'El código ya se usó.';

// An email is confirmed only when someone with the account's session types
// the code that reached it. Switching to another email also asks for the
// password.
@Injectable()
export class EmailConfirmationService {
  private readonly logger = new Logger(EmailConfirmationService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly codes: EmailCodeRepository,
    private readonly mail: MailService,
  ) {}

  // A fresh code for `email` and what to store for it: only its hash.
  async newCode(
    purpose: EmailCodePurpose,
    email: string,
    previous: EmailCode | null,
    now: Date,
  ) {
    const code = generateEmailCode();
    const record: NewEmailCode = {
      purpose,
      email,
      codeHash: await bcrypt.hash(code, 10),
      attempts: 0,
      expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS),
      sentAt: now,
      ...nextSendWindow(previous, now),
    };
    return { code, record };
  }

  // The code saved with a new account. If its mail can't be queued the
  // account still exists: asking for another code sends a new one.
  async mailRegistrationCode(user: User, code: string) {
    try {
      await this.mail.queueEmailCode({
        to: user.email,
        name: user.name,
        code,
        purpose: 'VERIFY',
      });
    } catch (error) {
      this.logger.error(
        `Could not queue the email code of the new user ${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async requestVerification(userId: string) {
    const user = await this.findUser(userId);
    if (user.emailVerifiedAt) {
      throw new ConflictException('Tu correo ya está confirmado');
    }
    await this.sendCode(user, 'VERIFY', user.email);
    return { sentTo: user.email };
  }

  async requestChange(userId: string, newEmail: string, password: string) {
    const user = await this.findUser(userId);
    // 400 and not 401: the front treats a 401 as an expired session.
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('La contraseña es incorrecta');
    }
    const owner = await this.users.findByEmail(newEmail);
    if (owner?.id === user.id) {
      throw new BadRequestException('Ese ya es tu correo');
    }
    if (owner) throw new ConflictException(EMAIL_IN_USE);

    await this.sendCode(user, 'CHANGE', newEmail);
    return { sentTo: newEmail };
  }

  async confirm(userId: string, code: string) {
    const now = new Date();
    const pending = await this.codes.findByUser(userId);
    if (!pending) {
      throw new BadRequestException(
        'No hay un código pendiente. Pedí uno nuevo.',
      );
    }
    if (pending.attempts >= EMAIL_CODE_ATTEMPTS) {
      throw new BadRequestException(
        'Probaste demasiadas veces. Pedí un código nuevo.',
      );
    }
    if (pending.expiresAt <= now) {
      throw new BadRequestException('El código venció. Pedí uno nuevo.');
    }
    if (!(await bcrypt.compare(code, pending.codeHash))) {
      await this.codes.registerWrongGuess(userId, pending.codeHash);
      throw new BadRequestException(wrongCodeMessage(pending.attempts + 1));
    }

    if (pending.purpose === 'VERIFY') {
      if (!(await this.codes.confirmEmail(userId, pending.codeHash, now))) {
        throw new BadRequestException(CODE_USED);
      }
      return;
    }
    await this.switchEmail(userId, pending, now);
  }

  private async switchEmail(userId: string, pending: EmailCode, now: Date) {
    const before = await this.findUser(userId);
    let email: string | null;
    try {
      email = await this.codes.changeEmail(userId, pending, now);
    } catch (error) {
      // Another account took that email after the code was sent.
      if (!isUniqueViolation(error)) throw error;
      await this.codes.delete(userId);
      throw new ConflictException(EMAIL_IN_USE);
    }
    if (!email) throw new BadRequestException(CODE_USED);

    // An email that was never confirmed may be mistyped or someone else's:
    // it gets no notice.
    if (!before.emailVerifiedAt) return;
    try {
      await this.mail.queueEmailChangedNotice({
        to: before.email,
        name: before.name,
        newEmail: maskEmail(email),
      });
    } catch (error) {
      this.logger.error(
        `Could not queue the email change notice of user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async sendCode(user: User, purpose: EmailCodePurpose, email: string) {
    const now = new Date();
    const previous = await this.codes.findByUser(user.id);
    const tooSoon = codeRequestError(previous, email, now);
    if (tooSoon) throw new HttpException(tooSoon, HttpStatus.TOO_MANY_REQUESTS);

    const { code, record } = await this.newCode(purpose, email, previous, now);
    await this.codes.save(user.id, record);
    await this.mail.queueEmailCode({
      to: email,
      name: user.name,
      code,
      purpose,
    });
  }

  private async findUser(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
