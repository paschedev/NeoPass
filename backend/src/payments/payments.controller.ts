import {
  Controller,
  Post,
  Body,
  Headers,
  Get,
  Query,
  Res,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import { PaymentsService } from './payments.service';
import { MercadoPagoOAuthService } from './mercadopago-oauth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// Signed with the session secret: `purpose` keeps a login token from being used as state.
type OAuthState = { sub?: string; purpose?: string };

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly oauthService: MercadoPagoOAuthService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  // The signature covers data.id from the query, not the body: the body is only
  // used to pick the seller's token when reading the payment.
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') dataId: string | undefined,
    @Query('type') type: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = body?.user_id;
    await this.paymentsService.enqueueNotification({
      signature,
      requestId,
      dataId,
      type,
      mpUserId:
        typeof userId === 'number' || typeof userId === 'string'
          ? String(userId)
          : undefined,
    });
    return { status: 'received' };
  }

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string,
    @Query('state') stateToken: string,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    if (!code || !stateToken) {
      return res.redirect(`${frontendUrl}/panel?mp_error=missing_params`);
    }

    try {
      const payload = this.jwtService.verify<OAuthState>(stateToken);
      if (payload.purpose !== 'oauth_state' || !payload.sub) {
        throw new Error('Invalid state token purpose');
      }

      await this.oauthService.exchangeCode(payload.sub, code);
      // Redirect to frontend dashboard with success flag
      return res.redirect(`${frontendUrl}/panel?mp_success=true`);
    } catch {
      // State inválido o vencido, o falla de Mercado Pago (exchangeCode ya la registra en el log).
      return res.redirect(`${frontendUrl}/panel?mp_error=true`);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ORGANIZER)
  @Get('oauth/link')
  getOauthLink(@CurrentUser('userId') userId: string) {
    const state: OAuthState = { sub: userId, purpose: 'oauth_state' };
    const stateToken = this.jwtService.sign(state, { expiresIn: '15m' });
    return { url: this.oauthService.authorizationUrl(stateToken) };
  }
}
