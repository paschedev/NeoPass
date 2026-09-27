import { describe, expect, it } from 'vitest';
import { buildChartSeries, getSmartMax } from './sales-chart';

// 26/09/2026 es sábado. Los tests corren con TZ de Argentina (vitest.config).
const saturdayNoon = new Date('2026-09-26T12:00:00');

describe('buildChartSeries', () => {
  it('esta semana: 7 barras que terminan hoy, con el día de la semana', () => {
    const series = buildChartSeries([], 'Esta semana', saturdayNoon);

    expect(series.map((bar) => bar.label)).toEqual([
      'Dom',
      'Lun',
      'Mar',
      'Mie',
      'Jue',
      'Vie',
      'Sab',
    ]);
    expect(series.map((bar) => bar.subLabel)).toEqual([
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
      '26',
    ]);
  });

  it('a la noche, las ventas de hoy siguen en la barra de hoy', () => {
    // 22:30 en Argentina ya es el 27 en UTC.
    const lateNight = new Date('2026-09-26T22:30:00');

    const series = buildChartSeries(
      [{ date: '2026-09-26', revenue: 5000 }],
      'Esta semana',
      lateNight,
    );

    expect(series.at(-1)).toMatchObject({ subLabel: '26', val: 5000 });
  });

  it('este mes: una barra por día y los días que faltan van vacíos', () => {
    const series = buildChartSeries(
      [
        { date: '2026-09-01', revenue: 100 },
        { date: '2026-09-27', revenue: 999 },
      ],
      'Este mes',
      saturdayNoon,
    );

    expect(series).toHaveLength(30);
    expect(series[0]).toMatchObject({ label: '1', subLabel: 'Sep', val: 100 });
    expect(series[26]).toMatchObject({ label: '27', future: true, val: 0 });
  });

  it('últimos 30 días: 30 barras que terminan hoy', () => {
    const series = buildChartSeries([], 'Últimos 30 días', saturdayNoon);

    expect(series).toHaveLength(30);
    expect(series[0]).toMatchObject({ label: '28', subLabel: 'Ago' });
    expect(series.at(-1)).toMatchObject({ label: '26', subLabel: 'Sep' });
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
