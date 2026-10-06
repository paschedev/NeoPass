import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  ValidateIf,
  validateSync,
} from 'class-validator';

const HTTP_URL = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_tld: false,
};

export class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  @IsUrl(HTTP_URL)
  FRONTEND_URL: string;

  @IsUrl(HTTP_URL)
  BACKEND_URL: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsString()
  @IsNotEmpty()
  MERCADOPAGO_ACCESS_TOKEN: string;

  @IsString()
  @IsNotEmpty()
  MERCADOPAGO_CLIENT_ID: string;

  @IsString()
  @IsNotEmpty()
  MERCADOPAGO_CLIENT_SECRET: string;

  // Signature secret of the Mercado Pago app (Tus integraciones → Webhooks).
  @IsString()
  @IsNotEmpty()
  MERCADOPAGO_WEBHOOK_SECRET: string;

  // Encrypts the organizers' Mercado Pago tokens in the database: 32 random
  // bytes in base64. Losing it means every organizer has to link again.
  @Matches(/^[A-Za-z0-9+/]{43}=$/)
  MERCADOPAGO_TOKEN_KEY: string;

  @IsString()
  @IsNotEmpty()
  RESEND_API_KEY: string;

  @IsString()
  @IsNotEmpty()
  CLOUDINARY_URL: string;

  // Client ID of the "Sign in with Google" button (Google Cloud → Credentials):
  // only credentials Google issued for it are accepted.
  @IsString()
  @IsNotEmpty()
  GOOGLE_CLIENT_ID: string;

  // Only an explicit "true" disables the captcha (local development).
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  CAPTCHA_DISABLED = false;

  @ValidateIf((env: EnvironmentVariables) => !env.CAPTCHA_DISABLED)
  @IsString()
  @IsNotEmpty()
  TURNSTILE_SECRET_KEY?: string;
}

// Runs at startup through ConfigModule: a missing or invalid variable stops the
// app. The error lists variable names only, never their values.
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const invalid = validateSync(env).map((error) => error.property);
  if (env.NODE_ENV === 'production' && env.CAPTCHA_DISABLED) {
    invalid.push('CAPTCHA_DISABLED');
  }
  if (invalid.length > 0) {
    throw new Error(`Invalid environment variables: ${invalid.join(', ')}`);
  }
  return env;
}
