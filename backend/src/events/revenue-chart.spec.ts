import { buildRevenueChart } from './revenue-chart';

const EVENT = 'evento-propio';

function order(createdAt: string, amount: number, eventId = EVENT) {
  return {
    createdAt: new Date(createdAt),
    orderItems: [{ quantity: 1, unitPrice: amount, ticketType: { eventId } }],
  };
}

describe('buildRevenueChart', () => {
  // 25/09 a las 23:00 en Argentina (UTC-3).
  const now = new Date('2026-09-26T02:00:00Z');

  it('tiene los últimos 30 días y termina hoy en hora de Argentina', () => {
    const chart = buildRevenueChart([], [EVENT], now);

    expect(chart).toHaveLength(30);
    expect(chart[0].date).toBe('2026-08-27');
    expect(chart[29].date).toBe('2026-09-25');
  });

  it('una venta a las 22:30 de Argentina cuenta para ese día aunque en UTC ya sea el siguiente', () => {
    const chart = buildRevenueChart(
      [order('2026-09-26T01:30:00Z', 1000)],
      [EVENT],
      now,
    );

    expect(chart.find((day) => day.date === '2026-09-25')?.revenue).toBe(1000);
  });

  it('solo suma las entradas de los eventos del organizador', () => {
    const chart = buildRevenueChart(
      [
        order('2026-09-25T15:00:00Z', 1000),
        order('2026-09-25T16:00:00Z', 500, 'otro'),
      ],
      [EVENT],
      now,
    );

    expect(chart[29].revenue).toBe(1000);
  });
});
