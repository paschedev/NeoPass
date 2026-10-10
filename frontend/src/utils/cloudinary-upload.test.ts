import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/utils/api';
import { uploadSignedImage } from './cloudinary-upload';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const SECURE_URL =
  'https://res.cloudinary.com/neopass/image/upload/v1/avatars/u1.jpg';
const photo = () => new File(['imagen'], 'yo.jpg', { type: 'image/jpeg' });
const cloudinaryFetch = vi.fn();

describe('uploadSignedImage', () => {
  beforeEach(() => vi.stubGlobal('fetch', cloudinaryFetch));

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('la foto de perfil se sube con su firma a la carpeta de la cuenta, reemplazando la anterior', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({
        signature: 'firma',
        timestamp: 1712345678,
        cloudName: 'neopass',
        apiKey: 'clave',
        publicId: 'avatars/u1',
        overwrite: true,
      }),
    );
    cloudinaryFetch.mockResolvedValue(
      Response.json({ secure_url: SECURE_URL }),
    );

    const result = await uploadSignedImage(photo(), '/media/avatar-presign');

    expect(result).toEqual({ url: SECURE_URL });
    expect(apiFetch).toHaveBeenCalledWith('/media/avatar-presign');
    const [endpoint, init] = cloudinaryFetch.mock.calls[0];
    expect(endpoint).toBe(
      'https://api.cloudinary.com/v1_1/neopass/image/upload',
    );
    const body = init.body as FormData;
    expect(body.get('signature')).toBe('firma');
    expect(body.get('public_id')).toBe('avatars/u1');
    expect(body.get('overwrite')).toBe('true');
    expect(body.get('upload_preset')).toBeNull();
  });

  it('si el backend no da la firma no sube nada', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ message: 'Unauthorized' }, { status: 401 }),
    );

    const result = await uploadSignedImage(photo(), '/media/avatar-presign');

    expect(result).toEqual({ error: 'No tenés permiso para subir imágenes' });
    expect(cloudinaryFetch).not.toHaveBeenCalled();
  });

  it('si Cloudinary rechaza el archivo devuelve un mensaje propio', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({
        signature: 'firma',
        timestamp: 1,
        cloudName: 'neopass',
        apiKey: 'clave',
      }),
    );
    cloudinaryFetch.mockResolvedValue(
      Response.json({ error: { message: 'Invalid image' } }, { status: 400 }),
    );

    const result = await uploadSignedImage(photo(), '/media/avatar-presign');

    expect(result).toEqual({
      error: 'No se pudo subir la imagen. Probá de nuevo.',
    });
  });
});
