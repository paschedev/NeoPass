import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly TURNSTILE_URL =
    'https://challenges.cloudflare.com/turnstile/v0/siteverify';
  private readonly disabled: boolean;

  constructor(private readonly config: ConfigService) {
    // validateEnv only allows it outside production.
    this.disabled = this.config.get('CAPTCHA_DISABLED') === true;
    if (this.disabled) {
      this.logger.warn('Captcha disabled by CAPTCHA_DISABLED=true');
    }
  }

  async assertHuman(token: string | undefined): Promise<void> {
    if (this.disabled) return;
    if (!token || !(await this.verifyToken(token))) {
      throw new BadRequestException(
        'Validación de seguridad fallida. Recargá la página.',
      );
    }
  }

  private async verifyToken(token: string): Promise<boolean> {
    try {
      const response = await fetch(this.TURNSTILE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: this.config.get<string>('TURNSTILE_SECRET_KEY'),
          response: token,
        }),
      });

      const data = (await response.json()) as { success?: boolean };
      return data.success === true;
    } catch (error) {
      this.logger.error('Turnstile verification failed', error);
      return false;
    }
  }
}
