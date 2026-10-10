import { maskEmail } from './mask-email';

describe('maskEmail', () => {
  it('deja la primera y la última letra antes de la arroba, y el dominio', () => {
    expect(maskEmail('nuevo@neopass.test')).toBe('n***o@neopass.test');
    expect(maskEmail('ana.perez@gmail.com')).toBe('a*******z@gmail.com');
  });

  it('con dos letras o menos antes de la arroba muestra solo la primera', () => {
    expect(maskEmail('jo@gmail.com')).toBe('j***@gmail.com');
  });
});
