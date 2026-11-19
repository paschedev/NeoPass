import {
  Controller,
  Post,
  Patch,
  Body,
  UnauthorizedException,
  Get,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CaptchaService } from './captcha.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleCredentialDto, GoogleSignInDto } from './dto/google-sign-in.dto';
import { GoogleLinkDto } from './dto/google-link.dto';
import { GooglePasswordDto } from './dto/google-password.dto';
import { GoogleSignInService } from './google-sign-in.service';
import { JwtAuthGuard } from './jwt-auth.guard';

// Stricter than the global limit: linking checks a password, which is slow on
// purpose, and signing in can create an account.
const GOOGLE_LIMIT = { default: { limit: 30, ttl: 60_000 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly googleSignIn: GoogleSignInService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    await this.captchaService.assertHuman(body.captchaToken);

    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return this.authService.login(user);
  }

  @Post('register')
  async register(@Body() body: RegisterUserDto) {
    await this.captchaService.assertHuman(body.captchaToken);

    return this.authService.register(body);
  }

  // No captcha: the credential signed by Google is the proof.
  @Throttle(GOOGLE_LIMIT)
  @Post('google')
  signInWithGoogle(@Body() body: GoogleSignInDto) {
    return this.googleSignIn.signIn(body.credential, {
      termsVersion: body.termsVersion,
      privacyVersion: body.privacyVersion,
    });
  }

  @Throttle(GOOGLE_LIMIT)
  @Post('google/link')
  linkGoogle(@Body() body: GoogleLinkDto) {
    return this.googleSignIn.link(body.credential, body.password);
  }

  @Throttle(GOOGLE_LIMIT)
  @UseGuards(JwtAuthGuard)
  @Post('google/connect')
  connectGoogle(
    @CurrentUser('userId') userId: string,
    @Body() body: GoogleCredentialDto,
  ) {
    return this.googleSignIn.connect(userId, body.credential);
  }

  @Throttle(GOOGLE_LIMIT)
  @UseGuards(JwtAuthGuard)
  @Post('google/password')
  createPasswordWithGoogle(
    @CurrentUser('userId') userId: string,
    @Body() body: GooglePasswordDto,
  ) {
    return this.googleSignIn.createPassword(
      userId,
      body.credential,
      body.password,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateProfile(
    @CurrentUser('userId') userId: string,
    @CurrentUser('role') role: UserRole,
    @Body() body: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(userId, role, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: any, @Body() body: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.userId,
      body.oldPassword,
      body.newPassword,
    );
  }

  // Each request can send a mail: a tight limit per IP on top of the one mail
  // per account every few minutes.
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @Post('forgot-password')
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  // Stricter than the global limit: it lists other users' names.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Get('users/search')
  searchUsers(@Query('q') query: string, @Req() req: any) {
    return this.authService.searchUsers(query, req.user.userId);
  }
}
