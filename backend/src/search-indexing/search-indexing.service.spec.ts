import { Queue } from 'bullmq';
import { SearchIndexingService } from './search-indexing.service';

const EVENT_ID = '3f1c2b6e-8a4d-4c1e-9b7a-2d5e6f708192';

describe('Encolar el aviso a los buscadores', () => {
  const add = jest.fn();
  const service = new SearchIndexingService({ add } as unknown as Queue);

  afterEach(() => jest.clearAllMocks());

  it('un evento publicado se avisa una vez por minuto, con reintentos', async () => {
    await service.eventChanged(EVENT_ID, ['PUBLISHED']);

    expect(add).toHaveBeenCalledWith(
      'event-changed',
      { eventId: EVENT_ID },
      expect.objectContaining({
        jobId: `event-${EVENT_ID}`,
        delay: 60_000,
        attempts: 5,
        removeOnComplete: true,
        removeOnFail: true,
      }),
    );
  });

  it('un borrador que sigue siendo borrador no se avisa', async () => {
    await service.eventChanged(EVENT_ID, ['DRAFT', 'DRAFT']);

    expect(add).not.toHaveBeenCalled();
  });

  it('pasar un evento publicado a borrador se avisa: su página deja de existir', async () => {
    await service.eventChanged(EVENT_ID, ['PUBLISHED', 'DRAFT']);

    expect(add).toHaveBeenCalledTimes(1);
  });

  it('si la cola no responde, el cambio del evento no falla', async () => {
    add.mockRejectedValueOnce(new Error('Redis caído'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      service.eventChanged(EVENT_ID, ['PUBLISHED']),
    ).resolves.toBeUndefined();
  });
});
