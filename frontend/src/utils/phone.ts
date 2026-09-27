import {
  AsYouType,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export const PHONE_PREFIXES = [
  { code: '+54', country: 'ar', label: 'AR' },
  { code: '+598', country: 'uy', label: 'UY' },
  { code: '+56', country: 'cl', label: 'CL' },
  { code: '+55', country: 'br', label: 'BR' },
  { code: '+51', country: 'pe', label: 'PE' },
  { code: '+52', country: 'mx', label: 'MX' },
  { code: '+57', country: 'co', label: 'CO' },
  { code: '+34', country: 'es', label: 'ES' },
  { code: '+1', country: 'us', label: 'US' },
];

export const findPhonePrefix = (code: string) =>
  PHONE_PREFIXES.find((prefix) => prefix.code === code) ?? PHONE_PREFIXES[0];

// Formatea lo que se va tipeando con las reglas del país del prefijo.
export function formatPhoneInput(value: string, prefixCode: string): string {
  if (!value) return '';
  const country = findPhonePrefix(prefixCode).country.toUpperCase();
  return new AsYouType(country as CountryCode).input(value);
}

/**
 * Joins the country prefix and the number typed by the user into the E.164
 * format the backend expects (+5491123456789). Returns null if it is not a
 * valid phone number.
 */
export function toE164Phone(prefix: string, number: string): string | null {
  const phone = parsePhoneNumberFromString(`${prefix}${number}`);
  return phone?.isValid() ? phone.number : null;
}
