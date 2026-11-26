import { ConfigService } from '@nestjs/config';
import { Job, UnrecoverableError } from 'bullmq';
import { SearchIndexingProcessor } from './search-indexing.processor';
import { EventChangedJob } from './search-indexing.service';

const EVENT_ID = '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192';

function processorFor(frontendUrl: string) {
  const config = {
    getOrThrow: () => frontendUrl,
  } as unknown as ConfigService;
  return new SearchIndexingProcessor(config);
}

const job = { data: { eventId: EVENT_ID } } as Job<EventChangedJob>;

describe('Aviso a los buscadores (IndexNow)', () => {
  let fetchMock: jest.SpyInstance;

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('desde producción avisa la página pública del evento con la clave del sitio', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    await processorFor('https://neopass.ar').process(job);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.indexnow.org/indexnow');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      host: 'neopass.ar',
      key: 'ebe64a3ffd5bb745a4b42b318079f8fe',
      keyLocation: 'https://neopass.ar/ebe64a3ffd5bb745a4b42b318079f8fe.txt',
      urlList: [`https://neopass.ar/eventos/${EVENT_ID}`],
    });
  });

  it('en local no avisa nada', async () => {
    await processorFor('http://localhost:3000').process(job);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('si IndexNow rechaza el pedido, no reintenta: no se arreglaría solo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 422 }));

    await expect(
      processorFor('https://neopass.ar').process(job),
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it('si IndexNow está caído o pide esperar, falla para que la cola reintente', async () => {
    for (const status of [429, 503]) {
      fetchMock.mockResolvedValueOnce(new Response(null, { status }));

      const failure = processorFor('https://neopass.ar').process(job);

      await expect(failure).rejects.toThrow(`IndexNow answered ${status}`);
      await expect(failure).rejects.not.toBeInstanceOf(UnrecoverableError);
    }
  });
});
