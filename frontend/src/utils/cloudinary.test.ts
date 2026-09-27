import { describe, expect, it } from 'vitest';
import { optimizeCloudinaryUrl } from './cloudinary';

const CLOUDINARY_URL =
  'https://res.cloudinary.com/neopass/image/upload/v1712345678/flyers/fiesta.jpg';

describe('optimizeCloudinaryUrl', () => {
  it('agrega formato y calidad automáticos a una imagen de Cloudinary', () => {
    expect(optimizeCloudinaryUrl(CLOUDINARY_URL)).toBe(
      'https://res.cloudinary.com/neopass/image/upload/f_auto,q_auto/v1712345678/flyers/fiesta.jpg',
    );
  });

  it('recorta la imagen a 16:9 cuando se pide el recorte', () => {
    expect(optimizeCloudinaryUrl(CLOUDINARY_URL, true)).toBe(
      'https://res.cloudinary.com/neopass/image/upload/f_auto,q_auto,c_fill,ar_16:9/v1712345678/flyers/fiesta.jpg',
    );
  });

  it('deja igual una imagen que no está en Cloudinary', () => {
    const url = 'https://example.com/upload/flyer.jpg';

    expect(optimizeCloudinaryUrl(url, true)).toBe(url);
  });

  it('deja igual una URL vacía', () => {
    expect(optimizeCloudinaryUrl('', true)).toBe('');
  });

  it('deja igual una URL de Cloudinary que no es de una imagen subida', () => {
    const url = 'https://res.cloudinary.com/neopass/image/fetch/flyer.jpg';

    expect(optimizeCloudinaryUrl(url, true)).toBe(url);
  });
});
