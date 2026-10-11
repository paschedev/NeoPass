// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchEventMetadata } from './event-metadata';

const EVENT_ID = '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192';

const event = {
  id: EVENT_ID,
  name: 'Noche de Techno',
  imageUrl:
    'https://res.cloudinary.com/neopass/image/upload/v1760000000/flyers/noche.jpg',
  // Sábado 14 de noviembre a las 23:00 en Argentina (domingo 02:00 en UTC).
  startDate: '2026-11-15T02:00:00.000Z',
  venueName: 'Club Central',
};

function respondWith(body: unknown, status = 200) {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.neopass.ar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Vista previa al compartir un evento', () => {
  it('muestra el flyer adaptado para compartir, el nombre, la fecha y el lugar', async () => {
    respondWith(event);

    const metadata = await fetchEventMetadata(EVENT_ID);

    expect(metadata.description).toBe('sáb, 14 nov, 23:00 hs · Club Central');
    expect(metadata.openGraph).toMatchObject({
      title: 'Noche de Techno',
      description: 'sáb, 14 nov, 23:00 hs · Club Central',
      images: [
        {
          url: 'https://res.cloudinary.com/neopass/image/upload/c_pad,b_auto,w_1200,h_630,f_jpg,q_auto/v1760000000/flyers/noche.jpg',
          width: 1200,
          height: 630,
          alt: 'Noche de Techno',
        },
      ],
    });
  });

  it('la pestaña dice el nombre del evento y NeoPass', async () => {
    respondWith(event);

    const metadata = await fetchEventMetadata(EVENT_ID);

    expect(metadata.title).toEqual({ absolute: 'Noche de Techno · NeoPass' });
  });

  it('la fecha sale en hora argentina aunque el servidor esté en UTC', async () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'UTC';
    try {
      respondWith(event);

      const metadata = await fetchEventMetadata(EVENT_ID);

      expect(metadata.description).toBe('sáb, 14 nov, 23:00 hs · Club Central');
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });

  it('pide el evento a la API sin el rpp del link, para no sumarle visitas al RPP', async () => {
    const fetchMock = respondWith(event);

    await fetchEventMetadata(EVENT_ID);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `https://api.neopass.ar/events/${EVENT_ID}`,
    );
  });

  it('sin flyer usa la imagen general de NeoPass, porque la del evento reemplaza entera a la de la home', async () => {
    respondWith({ ...event, imageUrl: null });

    const metadata = await fetchEventMetadata(EVENT_ID);

    expect(metadata.openGraph).toMatchObject({
      title: 'Noche de Techno',
      images: [
        { url: '/opengraph-image', width: 1200, height: 630, alt: 'NeoPass' },
      ],
    });
  });

  it('si el evento no existe o no está publicado, queda la vista previa general', async () => {
    respondWith({ message: 'No encontramos lo que buscás' }, 404);

    expect(await fetchEventMetadata(EVENT_ID)).toEqual({});
  });

  it('si la API falla, queda la vista previa general', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    expect(await fetchEventMetadata(EVENT_ID)).toEqual({});
  });

  it('si la API tarda más de 3 segundos, no la espera y queda la vista previa general', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            );
          }),
      ),
    );

    const preview = fetchEventMetadata(EVENT_ID);
    await vi.advanceTimersByTimeAsync(3000);

    await expect(preview).resolves.toEqual({});
  });

  it('un id que no es un UUID no llama a la API', async () => {
    const fetchMock = respondWith(event);

    expect(await fetchEventMetadata('../auth/me')).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
