import type { ConfigService } from '@nestjs/config';
import { AppConfig } from 'mercadopago/dist/utils/config';

const MERCADOPAGO_API = 'https://api.mercadopago.com';

// Mercado Pago's API, or the simulated one of a load test
// (MERCADOPAGO_API_URL, which validateEnv forbids in production).
export function mercadoPagoApiUrl(config: ConfigService): string {
  return config.get<string>('MERCADOPAGO_API_URL') ?? MERCADOPAGO_API;
}

// The SDK reads its URL from a static field on every request: setting it
// covers every client, the ones built with an organizer's token included.
export function useMercadoPagoApi(config: ConfigService) {
  (AppConfig as { BASE_URL: string }).BASE_URL = mercadoPagoApiUrl(config);
}
