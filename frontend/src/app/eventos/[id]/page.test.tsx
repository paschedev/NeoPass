// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import EventPage from './page';

const EVENT_ID = '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192';
const event = { id: EVENT_ID, title: 'Techno Night' };

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function respondWith(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json(body, { status })),
  );
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.neopass.ar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Página de un evento', () => {
  it('llega con el evento que respondió la API', async () => {
    respondWith(event);

    const page = await EventPage(params(EVENT_ID));

    expect(page.props.initialEvent).toEqual(event);
  });

  it('si la API dice que no existe, responde 404', async () => {
    respondWith({ message: 'Evento no encontrado' }, 404);

    await expect(EventPage(params(EVENT_ID))).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
  });

  it('un id que no es de un evento responde 404 sin llamar a la API', async () => {
    respondWith(event);

    await expect(EventPage(params('demo-beach-sunset'))).rejects.toMatchObject({
      digest: expect.stringContaining('404'),
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('si la API no respondió, no responde 404: el navegador lo vuelve a pedir', async () => {
    respondWith({ message: 'Error' }, 503);

    const page = await EventPage(params(EVENT_ID));

    expect(page.props.initialEvent).toBeNull();
  });
});
