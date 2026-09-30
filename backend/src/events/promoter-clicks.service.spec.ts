import { PromoterClicksService } from './promoter-clicks.service';
import { EventsRepository } from './repositories/events.repository';

const MINUTE_MS = 60 * 1000;
const START = Date.parse('2026-09-30T12:00:00Z');

describe('PromoterClicksService', () => {
  let incrementAcceptedPromoterClicks: jest.Mock<
    Promise<boolean>,
    [string, string]
  >;
  let clicks: PromoterClicksService;

  beforeEach(() => {
    incrementAcceptedPromoterClicks = jest
      .fn<Promise<boolean>, [string, string]>()
      .mockResolvedValue(true);
    clicks = new PromoterClicksService({
      incrementAcceptedPromoterClicks,
    } as unknown as EventsRepository);
  });

  function visit(minutes: number, ip = '203.0.113.10') {
    return clicks.register('evento', 'rpp', ip, START + minutes * MINUTE_MS);
  }

  it('cuenta la primera visita de un visitante', async () => {
    await visit(0);

    expect(incrementAcceptedPromoterClicks).toHaveBeenCalledWith(
      'evento',
      'rpp',
    );
  });

  it('no vuelve a contar al mismo visitante dentro de la hora', async () => {
    await visit(0);
    await visit(59);

    expect(incrementAcceptedPromoterClicks).toHaveBeenCalledTimes(1);
  });

  it('pasada la hora, el mismo visitante vuelve a contar', async () => {
    await visit(0);
    await visit(60);

    expect(incrementAcceptedPromoterClicks).toHaveBeenCalledTimes(2);
  });

  it('una visita que no contó no frena la siguiente del mismo visitante', async () => {
    incrementAcceptedPromoterClicks.mockResolvedValueOnce(false);

    await visit(0);
    await visit(1);

    expect(incrementAcceptedPromoterClicks).toHaveBeenCalledTimes(2);
  });
});
