type OrganizerToken = {
  mercadoPagoAccessToken: string | null;
  mercadoPagoTokenExpiresAt: Date | null;
};

// An organizer can collect with their token until it expires. A token without
// a known expiry was linked before renewals existed: it is used as before.
export function hasUsableMercadoPagoToken<T extends OrganizerToken>(
  organizer: T,
  now: Date,
): organizer is T & { mercadoPagoAccessToken: string } {
  if (!organizer.mercadoPagoAccessToken) return false;
  return (
    !organizer.mercadoPagoTokenExpiresAt ||
    organizer.mercadoPagoTokenExpiresAt > now
  );
}

// Body of POST /oauth/token, both for the authorization code and a renewal.
export type MercadoPagoTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  public_key?: string;
  user_id?: number;
};

export function toMercadoPagoCredentials(
  data: MercadoPagoTokenResponse,
  now: Date,
) {
  return {
    mercadoPagoAccessToken: data.access_token,
    mercadoPagoRefreshToken: data.refresh_token ?? null,
    mercadoPagoTokenExpiresAt: data.expires_in
      ? new Date(now.getTime() + data.expires_in * 1000)
      : null,
    mercadoPagoPublicKey: data.public_key,
    mercadoPagoUserId: data.user_id?.toString(),
  };
}

export type MercadoPagoCredentials = ReturnType<
  typeof toMercadoPagoCredentials
>;
