import { describe, expect, it } from 'vitest';
import { optimizeCloudinaryUrl, validateImageFile } from './cloudinary';

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

const imageFile = (type: string, sizeMb = 1) =>
  new File([new Uint8Array(sizeMb * 1024 * 1024)], 'flyer', { type });

describe('validateImageFile', () => {
  it('acepta JPG, PNG, WebP, AVIF y GIF de hasta 10 MB', () => {
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/gif',
    ]) {
      expect(validateImageFile(imageFile(type, 10))).toBeNull();
    }
  });

  it('rechaza un archivo que no es un formato de imagen permitido', () => {
    expect(validateImageFile(imageFile('image/svg+xml'))).toBe(
      'Formato no permitido. Solo JPG, PNG, WebP, AVIF o GIF.',
    );
    expect(validateImageFile(imageFile('application/pdf'))).not.toBeNull();
  });

  it('rechaza una imagen de más de 10 MB', () => {
    expect(validateImageFile(imageFile('image/png', 11))).toBe(
      'La imagen supera el límite de 10 MB.',
    );
  });
});
