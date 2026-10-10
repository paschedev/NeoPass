import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { UserRepository } from './repositories/user.repository';
import { EmailCodeRepository } from './repositories/email-code.repository';
import { CaptchaService } from './captcha.service';
import { EmailConfirmationController } from './email-confirmation.controller';
import { EmailConfirmationService } from './email-confirmation.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: '30d' },
      }),
    }),
    MailModule,
  ],
  controllers: [AuthController, EmailConfirmationController],
  providers: [
    AuthService,
    JwtStrategy,
    UserRepository,
    CaptchaService,
    EmailConfirmationService,
    EmailCodeRepository,
  ],
  exports: [AuthService, UserRepository, CaptchaService, JwtModule],
})
export class AuthModule {}
