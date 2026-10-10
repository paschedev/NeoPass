import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { ChangeEmailDto } from './dto/change-email.dto';
import { ConfirmEmailDto } from './dto/confirm-email.dto';
import { EmailConfirmationService } from './email-confirmation.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('auth/email')
export class EmailConfirmationController {
  constructor(
    private readonly emailConfirmation: EmailConfirmationService,
    private readonly authService: AuthService,
  ) {}

  @Post('verification')
  requestVerification(@CurrentUser('userId') userId: string) {
    return this.emailConfirmation.requestVerification(userId);
  }

  // Stricter than the global limit: it checks the password.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('change')
  requestChange(
    @CurrentUser('userId') userId: string,
    @Body() body: ChangeEmailDto,
  ) {
    return this.emailConfirmation.requestChange(
      userId,
      body.newEmail,
      body.password,
    );
  }

  // Answers with the updated profile, for the session the front keeps.
  @Post('confirm')
  async confirm(
    @CurrentUser('userId') userId: string,
    @Body() body: ConfirmEmailDto,
  ) {
    await this.emailConfirmation.confirm(userId, body.code);
    return this.authService.getProfile(userId);
  }
}
