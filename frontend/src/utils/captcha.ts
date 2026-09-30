import type { TurnstileProps } from '@marsidev/react-turnstile';

// Turnstile con el tema oscuro, al ancho del contenedor y visible solo si
// Cloudflare necesita que el usuario interactúe.
export const TURNSTILE_OPTIONS: TurnstileProps['options'] = {
  theme: 'dark',
  size: 'flexible',
  appearance: 'interaction-only',
};
