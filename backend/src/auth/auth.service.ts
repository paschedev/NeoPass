import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from './repositories/user.repository';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import { hasUsableMercadoPagoToken } from '../payments/mercadopago-token';
import * as crypto from 'crypto';
import { Prisma, User } from '@prisma/client';
import { RegisterUserDto } from './dto/register-user.dto';
import { isUniqueViolation } from '../prisma/prisma-errors';

const EMAIL_TAKEN = 'El correo electrónico ya existe';

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  private signToken(user: { id: string; email: string; role: string }) {
    return this.jwtService.sign({
      email: user.email,
      sub: user.id,
      role: user.role,
    });
  }

  async login(user: any) {
    const hasBeenRpp = await this.userRepository.checkHasBeenRpp(user.id);
    const isCurrentlyScanner =
      await this.userRepository.checkIsCurrentlyScanner(user.id);
    return {
      access_token: this.signToken(user),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasLinkedMp: hasUsableMercadoPagoToken(user, new Date()),
        hasBeenRpp,
        isCurrentlyScanner,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedException();

    const hasBeenRpp = await this.userRepository.checkHasBeenRpp(user.id);
    const isCurrentlyScanner =
      await this.userRepository.checkIsCurrentlyScanner(user.id);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      hasLinkedMp: hasUsableMercadoPagoToken(user, new Date()),
      hasBeenRpp,
      isCurrentlyScanner,
    };
  }

  async register(data: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictException(EMAIL_TAKEN);
    }

    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(data.password, salt);

    const userCreateInput: Prisma.UserCreateInput = {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      passwordHash: hashedPassword,
      role: data.role as any,
    };

    if (data.role === 'ORGANIZER') {
      userCreateInput.organizerProfile = {
        create: {
          phone: data.phone,
          companyName: data.companyName,
        },
      };

      userCreateInput.ticketPresets = {
        create: [
          { name: 'General', price: 0 },
          { name: 'VIP', price: 0 },
        ],
      };
    }

    let user: User;
    try {
      user = await this.userRepository.create(userCreateInput);
    } catch (error) {
      // Another registration for the same mailbox was saved in between.
      if (isUniqueViolation(error)) throw new ConflictException(EMAIL_TAKEN);
      throw error;
    }

    const { passwordHash, ...result } = user;
    return {
      ...result,
      hasBeenRpp: false,
      isCurrentlyScanner: false,
      hasLinkedMp: false,
    };
  }

  async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const isValid = await bcrypt.compare(oldPass, user.passwordHash);
    // 400 and not 401: the front treats a 401 as an expired session.
    if (!isValid) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const salt = await bcrypt.genSalt();
    const newHash = await bcrypt.hash(newPass, salt);

    // Closes every other session; this one continues with a new token.
    await this.userRepository.update(userId, {
      passwordHash: newHash,
      passwordChangedAt: new Date(),
    });

    return {
      message: 'Contraseña actualizada con éxito',
      access_token: this.signToken(user),
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Return success even if not found for security reasons
      return {
        message:
          'Si el correo existe, te enviamos un enlace para recuperar la contraseña.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

    // Only the hash is stored: a database leak doesn't expose usable links.
    await this.userRepository.update(user.id, {
      passwordResetToken: hashResetToken(resetToken),
      passwordResetExpires: resetTokenExpires,
    });

    const resetLink = `${this.config.getOrThrow<string>('FRONTEND_URL')}/reset-password?token=${resetToken}`;

    await this.mailService.queuePasswordResetEmail({
      to: user.email,
      name: user.name,
      resetLink,
    });

    return {
      message:
        'Si el correo existe, te enviamos un enlace para recuperar la contraseña.',
    };
  }

  async resetPassword(token: string, newPass: string) {
    const user = await this.userRepository.findByResetToken(
      hashResetToken(token),
    );

    if (!user) {
      throw new BadRequestException(
        'El link para cambiar la contraseña no es válido o venció',
      );
    }

    const salt = await bcrypt.genSalt();
    const newHash = await bcrypt.hash(newPass, salt);

    // Whoever had the old password loses their open sessions too.
    await this.userRepository.update(user.id, {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      passwordChangedAt: new Date(),
    });

    return { message: 'Contraseña restablecida con éxito' };
  }

  async searchUsers(query: string, excludeUserId?: string) {
    if (!query || query.length < 3) return [];
    return this.userRepository.search(query, excludeUserId);
  }
}
