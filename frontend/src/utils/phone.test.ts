import { describe, expect, it } from 'vitest';
import { formatPhoneInput, toE164Phone } from './phone';

describe('toE164Phone', () => {
  it('pasa un número argentino con espacios y guiones a formato internacional', () => {
    expect(toE164Phone('+54', '11 2345-6789')).toBe('+541123456789');
  });

  it('respeta el 9 de los celulares argentinos', () => {
    expect(toE164Phone('+54', '9 11 2345 6789')).toBe('+5491123456789');
  });

  it('funciona con otros países de la lista', () => {
    expect(toE164Phone('+598', '94 123 456')).toBe('+59894123456');
  });

  it('devuelve null si el número no es válido', () => {
    expect(toE164Phone('+54', '123')).toBeNull();
  });
});

describe('formatPhoneInput', () => {
  it('formatea el número mientras se escribe, según el país del prefijo', () => {
    expect(formatPhoneInput('1123456789', '+54')).toBe('11 2345-6789');
  });

  it('un campo vacío queda vacío', () => {
    expect(formatPhoneInput('', '+54')).toBe('');
  });
});
