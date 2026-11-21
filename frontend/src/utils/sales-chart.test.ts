import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  getSmartMax,
  hasSales,
  labeledDays,
  smoothPath,
  summarizeSales,
} from './sales-chart';

// 26/09/2026 es sábado. Los tests corren con TZ de Argentina (vitest.config).
const saturdayNoon = new Date('2026-09-26T12:00:00');

describe('summarizeSales', () => {
  it('7 días que terminan hoy, con lo vendido acumulado día a día', () => {
    const summary = summarizeSales(
      [
        { date: '2026-09-20', revenue: 1000 },
        { date: '2026-09-23', revenue: 500 },
        { date: '2026-09-26', revenue: 250 },
      ],
      7,
      saturdayNoon,
    );

    expect(summary.days.map((day) => dayLabel(day.date, 7))).toEqual([
      'Dom 20',
      'Lun 21',
      'Mar 22',
      'Mié 23',
      'Jue 24',
      'Vie 25',
      'Sáb 26',
    ]);
    expect(summary.days.map((day) => day.cumulative)).toEqual([
      1000, 1000, 1000, 1500, 1500, 1500, 1750,
    ]);
    expect(summary.total).toBe(1750);
  });

  it('a la noche, las ventas de hoy siguen en el día de hoy', () => {
    // 22:30 en Argentina ya es el 27 en UTC.
    const lateNight = new Date('2026-09-26T22:30:00');

    const summary = summarizeSales(
      [{ date: '2026-09-26', revenue: 5000 }],
      7,
      lateNight,
    );

    expect(summary.days.at(-1)).toMatchObject({ revenue: 5000 });
  });

  it('compara con los 7 días anteriores', () => {
    const summary = summarizeSales(
      [
        { date: '2026-09-13', revenue: 800 },
        { date: '2026-09-19', revenue: 200 },
        { date: '2026-09-25', revenue: 1500 },
        // Hace 14 días: queda afuera de los dos períodos.
        { date: '2026-09-12', revenue: 99999 },
      ],
      7,
      saturdayNoon,
    );

    expect(summary.previousTotal).toBe(1000);
    expect(summary.change).toBe(50);
  });

  it('30 días contra los 30 anteriores, con los 60 que manda el servidor', () => {
    const summary = summarizeSales(
      [
        { date: '2026-07-29', revenue: 2000 },
        { date: '2026-08-28', revenue: 1000 },
        { date: '2026-08-27', revenue: 3000 },
      ],
      30,
      saturdayNoon,
    );

    expect(summary.days).toHaveLength(30);
    expect(dayLabel(summary.days[0].date, 30)).toBe('28 ago');
    expect(summary.total).toBe(1000);
    expect(summary.previousTotal).toBe(5000);
    expect(summary.change).toBe(-80);
  });

  it('sin ventas en el período anterior no hay variación', () => {
    const summary = summarizeSales(
      [{ date: '2026-09-26', revenue: 100 }],
      7,
      saturdayNoon,
    );

    expect(summary.change).toBeNull();
  });

  it('suma al centavo, sin errores de redondeo', () => {
    const summary = summarizeSales(
      [
        { date: '2026-09-24', revenue: 1500.15 },
        { date: '2026-09-25', revenue: 1500.15 },
        { date: '2026-09-26', revenue: 1500.15 },
      ],
      7,
      saturdayNoon,
    );

    expect(summary.total).toBe(4500.45);
  });
});

describe('hasSales', () => {
  it('solo cuenta los días con plata', () => {
    expect(hasSales([])).toBe(false);
    expect(hasSales([{ date: '2026-09-26', revenue: 0 }])).toBe(false);
    expect(hasSales([{ date: '2026-09-26', revenue: 10 }])).toBe(true);
  });
});

describe('labeledDays', () => {
  it('todos en la semana; en el mes, uno cada 6 y el último sin pegarse', () => {
    expect(labeledDays(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(labeledDays(30)).toEqual([0, 6, 12, 18, 24, 29]);
  });
});

describe('smoothPath', () => {
  it('pasa por cada punto y no se sale del tramo', () => {
    const path = smoothPath([
      [0, 100],
      [50, 100],
      [100, 0],
    ]);

    expect(path.startsWith('M0 100C')).toBe(true);
    expect(path.endsWith(' 100 0')).toBe(true);
    const ys = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => +m[2]);
    expect(Math.max(...ys)).toBeLessThanOrEqual(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
  });
});

describe('getSmartMax', () => {
  it.each([
    [0, 100],
    [100, 100],
    [150, 200],
    [350, 400],
    [4500, 5000],
    [9000, 10000],
  ])('el eje para un máximo de %i llega a %i', (max, expected) => {
    expect(getSmartMax(max)).toBe(expected);
  });
});
