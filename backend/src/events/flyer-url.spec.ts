import { isOwnFlyerUrl } from './flyer-url';

const CLOUDINARY_URL = 'cloudinary://clave:secreto@neopass';

describe('isOwnFlyerUrl', () => {
  it('acepta una imagen de la cuenta de Cloudinary de NeoPass', () => {
    expect(
      isOwnFlyerUrl(
        'https://res.cloudinary.com/neopass/image/upload/v1/flyer.jpg',
        CLOUDINARY_URL,
      ),
    ).toBe(true);
  });

  it.each([
    ['de otro sitio', 'https://mi-servidor.com/flyer.jpg'],
    ['de otra cuenta', 'https://res.cloudinary.com/otra/image/upload/f.jpg'],
    [
      'de una cuenta que empieza igual',
      'https://res.cloudinary.com/neopass-falsa/image/upload/f.jpg',
    ],
    [
      'que sale de la cuenta con ".."',
      'https://res.cloudinary.com/neopass/../otra/image/upload/f.jpg',
    ],
    ['sin https', 'http://res.cloudinary.com/neopass/image/upload/f.jpg'],
    [
      'con usuario en el link',
      'https://alguien@res.cloudinary.com/neopass/image/upload/f.jpg',
    ],
    ['que no es un link', 'javascript:alert(1)'],
  ])('rechaza una imagen %s', (_case, url) => {
    expect(isOwnFlyerUrl(url, CLOUDINARY_URL)).toBe(false);
  });
});
