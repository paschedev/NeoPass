import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { useCloudinaryUpload } from './useCloudinaryUpload';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(() => 'toast-1'),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const SIGNATURE = {
  signature: 'firma',
  timestamp: 1712345678,
  cloudName: 'neopass',
  apiKey: 'clave',
  uploadPreset: 'neopass_flyers',
};
const SECURE_URL =
  'https://res.cloudinary.com/neopass/image/upload/v1/flyers/fiesta.jpg';

const flyer = () => new File(['imagen'], 'fiesta.jpg', { type: 'image/jpeg' });
const cloudinaryFetch = vi.fn();

describe('useCloudinaryUpload', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', cloudinaryFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('sube la imagen con la firma del backend y devuelve la URL segura', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json(SIGNATURE));
    cloudinaryFetch.mockResolvedValue(
      Response.json({ secure_url: SECURE_URL }),
    );
    const { result } = renderHook(() => useCloudinaryUpload());
    const file = flyer();

    let url;
    await act(async () => {
      url = await result.current.upload(file);
    });

    expect(url).toBe(SECURE_URL);
    expect(apiFetch).toHaveBeenCalledWith('/media/presign');
    const [endpoint, init] = cloudinaryFetch.mock.calls[0];
    expect(endpoint).toBe(
      'https://api.cloudinary.com/v1_1/neopass/image/upload',
    );
    const body = init.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('api_key')).toBe('clave');
    expect(body.get('timestamp')).toBe('1712345678');
    expect(body.get('signature')).toBe('firma');
    expect(body.get('upload_preset')).toBe('neopass_flyers');
    expect(toast.success).toHaveBeenCalledWith('Imagen subida', {
      id: 'toast-1',
    });
  });

  it('con un archivo no permitido avisa y no pide la firma', async () => {
    const { result } = renderHook(() => useCloudinaryUpload());
    const pdf = new File(['x'], 'flyer.pdf', { type: 'application/pdf' });

    let url;
    await act(async () => {
      url = await result.current.upload(pdf);
    });

    expect(url).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'Formato no permitido. Solo JPG, PNG, WebP, AVIF o GIF.',
    );
  });

  it('si el backend no autoriza la subida, avisa y no sube nada', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ message: 'Forbidden resource' }, { status: 403 }),
    );
    const { result } = renderHook(() => useCloudinaryUpload());

    let url;
    await act(async () => {
      url = await result.current.upload(flyer());
    });

    expect(url).toBeNull();
    expect(cloudinaryFetch).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      'No tenés permiso para subir imágenes',
      { id: 'toast-1' },
    );
  });

  it('si Cloudinary rechaza el archivo, avisa con un mensaje propio', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json(SIGNATURE));
    cloudinaryFetch.mockResolvedValue(
      Response.json(
        { error: { message: 'Invalid image file' } },
        { status: 400 },
      ),
    );
    const { result } = renderHook(() => useCloudinaryUpload());

    let url;
    await act(async () => {
      url = await result.current.upload(flyer());
    });

    expect(url).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      'No se pudo subir la imagen. Probá de nuevo.',
      { id: 'toast-1' },
    );
  });

  it('marca la subida en curso hasta que termina', async () => {
    let finishUpload: (res: Response) => void = () => {};
    vi.mocked(apiFetch).mockResolvedValue(Response.json(SIGNATURE));
    cloudinaryFetch.mockReturnValue(
      new Promise<Response>((resolve) => {
        finishUpload = resolve;
      }),
    );
    const { result } = renderHook(() => useCloudinaryUpload());

    let pending: Promise<string | null> = Promise.resolve(null);
    act(() => {
      pending = result.current.upload(flyer());
    });
    expect(result.current.uploading).toBe(true);

    await act(async () => {
      finishUpload(Response.json({ secure_url: SECURE_URL }));
      await pending;
    });
    expect(result.current.uploading).toBe(false);
  });
});
