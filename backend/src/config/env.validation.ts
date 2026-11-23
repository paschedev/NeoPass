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
  // only credentials Google issued for it are accepted. Optional: without it
  // "Continuar con Google" is off and the API answers that it isn't available.
  @IsOptional()
  @IsString()
  GOOGLE_CLIENT_ID?: string;

  // Only an explicit "true" disables the captcha (local development).
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  CAPTCHA_DISABLED = false;

  @ValidateIf((env: EnvironmentVariables) => !env.CAPTCHA_DISABLED)
  @IsString()
  @IsNotEmpty()
  TURNSTILE_SECRET_KEY?: string;

  // Load tests only: Mercado Pago's and Resend's APIs replaced by simulated
  // ones (Resend's SDK also reads it on its own), and a header that names
  // each simulated buyer for the request limits, since they all come from
  // the same generator.
  @IsOptional()
  @IsUrl(HTTP_URL)
  MERCADOPAGO_API_URL?: string;

  @IsOptional()
  @IsUrl(HTTP_URL)
  RESEND_BASE_URL?: string;

  @IsOptional()
  @Matches(/^[a-z0-9-]{1,64}$/)
  LOAD_TEST_CLIENT_HEADER?: string;

  // Set by Railway in every environment.
  @IsOptional()
  @IsString()
  RAILWAY_ENVIRONMENT_NAME?: string;
}

// Only for local development and load tests: they turn off the captcha or
// point the app at simulated services.
const TEST_ONLY_VARIABLES = [
  'CAPTCHA_DISABLED',
  'MERCADOPAGO_API_URL',
  'RESEND_BASE_URL',
  'LOAD_TEST_CLIENT_HEADER',
] as const;

// Railway names the environment on its own, so production is recognized even
// if NODE_ENV went missing.
function isProduction(env: EnvironmentVariables) {
  return (
    env.NODE_ENV === 'production' ||
    env.RAILWAY_ENVIRONMENT_NAME?.toLowerCase() === 'production'
  );
}

// Runs at startup through ConfigModule: a missing or invalid variable stops the
// app. The error lists variable names only, never their values.
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const invalid = validateSync(env).map((error) => error.property);
  if (isProduction(env)) {
    invalid.push(...TEST_ONLY_VARIABLES.filter((name) => env[name]));
  }
  if (invalid.length > 0) {
    throw new Error(`Invalid environment variables: ${invalid.join(', ')}`);
  }
  return env;
}
