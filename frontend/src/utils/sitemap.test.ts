// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSitemap } from './sitemap';

const PAGES = [
  'https://neopass.ar/',
  'https://neopass.ar/eventos',
  'https://neopass.ar/terminos',
  'https://neopass.ar/terminos/organizadores',
  'https://neopass.ar/privacidad',
];

const page = (ids: string[], total: number) =>
  new Response(JSON.stringify({ items: ids.map((id) => ({ id })), total }));

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.neopass.ar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Mapa del sitio', () => {
  it('lista las páginas públicas y cada evento publicado, sin el panel ni el ingreso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(page(['a', 'b'], 2)));

    const urls = (await buildSitemap(3600)).map((entry) => entry.url);

    expect(urls).toEqual([
      ...PAGES,
      'https://neopass.ar/eventos/a',
      'https://neopass.ar/eventos/b',
    ]);
  });

  it('recorre todas las páginas de la API, de a 50 eventos', async () => {
    const fiftyIds = Array.from({ length: 50 }, (_, i) => `e${i}`);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(fiftyIds, 51))
      .mockResolvedValueOnce(page(['ultimo'], 51));
    vi.stubGlobal('fetch', fetchMock);

    const urls = (await buildSitemap(3600)).map((entry) => entry.url);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'https://api.neopass.ar/events?page=1&limit=50',
      'https://api.neopass.ar/events?page=2&limit=50',
    ]);
    expect(urls).toHaveLength(PAGES.length + 51);
    expect(urls.at(-1)).toBe('https://neopass.ar/eventos/ultimo');
  });

  it('si la API falla, el mapa sale igual con las páginas públicas', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );

    const urls = (await buildSitemap(3600)).map((entry) => entry.url);

    expect(urls).toEqual(PAGES);
  });

  it('si la API responde con error, no insiste y deja las páginas públicas', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    const urls = (await buildSitemap(3600)).map((entry) => entry.url);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(urls).toEqual(PAGES);
  });
});
