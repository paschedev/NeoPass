import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PaymentsRepository } from './repositories/payments.repository';
import {
  MercadoPagoTokenResponse,
  toMercadoPagoCredentials,
} from './mercadopago-token';

const DAY_MS = 24 * 60 * 60 * 1000;
// Tokens last 180 days: the ones that expire within this window get renewed.
const RENEWAL_WINDOW_MS = 30 * DAY_MS;

// Links an organizer's Mercado Pago account (OAuth authorization code) and
// keeps its token alive with the refresh token, which changes on every renewal.
@Injectable()
export class MercadoPagoOAuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MercadoPagoOAuthService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly config: ConfigService,
  ) {}

  // Tokens linked before they were stored encrypted get encrypted before the
  // app serves requests. If it fails, the app does not start.
  async onApplicationBootstrap() {
    await this.encryptPlaintextTokens();
  }

  async encryptPlaintextTokens() {
    const updated =
      await this.paymentsRepository.encryptPlaintextMercadoPagoTokens();
    if (updated > 0) {
      this.logger.log(
        `Encrypted the Mercado Pago tokens of ${updated} organizers`,
      );
    }
  }

  authorizationUrl(state: string) {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_ID'),
      response_type: 'code',
      platform_id: 'mp',
      redirect_uri: this.callbackUrl(),
      state,
    });
    return `https://auth.mercadopago.com/authorization?${params.toString()}`;
  }

  async exchangeCode(userId: string, code: string) {
    try {
      const data = await this.requestToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.callbackUrl(),
      });
      if (!data.refresh_token) {
        this.logger.warn(
          `Mercado Pago linked organizer ${userId} without a refresh token: the token cannot be renewed`,
        );
      }
      await this.paymentsRepository.updateUserMercadoPagoCredentials(
        userId,
        toMercadoPagoCredentials(data, new Date()),
      );
    } catch (error) {
      this.logger.error('Error exchanging Mercado Pago code', error);
      throw error;
    }
  }

  // Every day at 06:00 UTC (03:00 in Argentina).
  @Cron('0 6 * * *')
  async handleTokenRenewal() {
    try {
      await this.refreshExpiringTokens(new Date());
    } catch (error) {
      this.logger.error('Error renewing Mercado Pago tokens', error);
    }
  }

  // One failed renewal does not stop the rest; it is retried the next day
  // while the token is still inside the window. The clock is a parameter so
  // tests can fix it.
  async refreshExpiringTokens(now: Date) {
    const organizers =
      await this.paymentsRepository.findMercadoPagoTokensExpiringBefore(
        new Date(now.getTime() + RENEWAL_WINDOW_MS),
      );
    for (const { id, refreshToken } of organizers) {
      try {
        const data = await this.requestToken({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        });
        const saved =
          await this.paymentsRepository.replaceMercadoPagoCredentials(
            id,
            refreshToken,
            toMercadoPagoCredentials(data, now),
          );
        if (!saved) {
          this.logger.warn(
            `Mercado Pago credentials of organizer ${id} changed while renewing them`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Could not renew the Mercado Pago token of organizer ${id}`,
          error,
        );
      }
    }
  }

  private callbackUrl() {
    return `${this.config.getOrThrow<string>('BACKEND_URL')}/payments/oauth/callback`;
  }

  private async requestToken(
    params: Record<string, string>,
  ): Promise<MercadoPagoTokenResponse> {
    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${this.config.getOrThrow<string>('MERCADOPAGO_ACCESS_TOKEN')}`,
      },
      body: new URLSearchParams({
        client_id: this.config.getOrThrow<string>('MERCADOPAGO_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>(
          'MERCADOPAGO_CLIENT_SECRET',
        ),
        ...params,
      }).toString(),
    });
    const data =
      (await response.json()) as Partial<MercadoPagoTokenResponse> & {
        message?: string;
      };
    if (!response.ok || !data.access_token) {
      throw new Error(
        `Mercado Pago OAuth responded ${response.status}: ${data.message ?? 'without an access token'}`,
      );
    }
    return data as MercadoPagoTokenResponse;
  }
}
