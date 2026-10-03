import { Prisma } from '@prisma/client';
import { buildEventSales } from './event-sales';

const now = new Date('2026-10-10T20:00:00.000Z');
const eventEnd = new Date('2026-10-20T06:00:00.000Z');

const ticketType = (id: string, overrides = {}) => ({
  id,
  name: 'General',
  price: new Prisma.Decimal(1000),
  stock: 100,
  sold: 0,
  reserved: 0,
  ...overrides,
});

const batch = (id: string, ticketTypes: ReturnType<typeof ticketType>[]) => ({
  id,
  name: `Tanda ${id}`,
  isVisible: true,
  publishAt: null,
  closeAt: null,
  ticketTypes,
});

describe('buildEventSales', () => {
  it('suma lo cobrado, lo vendido, lo reservado y el total de entradas', () => {
    const sales = buildEventSales(
      {
        endDate: eventEnd,
        ticketBatches: [
          batch('b1', [ticketType('t1', { sold: 2, reserved: 1 })]),
          batch('b2', [ticketType('t2', { stock: 50, sold: 1 })]),
        ],
      },
      new Map([
        ['t1', new Prisma.Decimal('2000.10')],
        ['t2', new Prisma.Decimal('1999.95')],
      ]),
      now,
    );

    expect(sales.totals).toEqual({
      revenue: 4000.05,
      sold: 3,
      reserved: 1,
      capacity: 150,
    });
    expect(sales.batches[0].ticketTypes[0]).toEqual({
      id: 't1',
      name: 'General',
      price: 1000,
      stock: 100,
      sold: 2,
      reserved: 1,
      available: 97,
      revenue: 2000.1,
    });
  });

  it('un tipo de entrada sin compras pagadas tiene recaudado cero', () => {
    const sales = buildEventSales(
      { endDate: eventEnd, ticketBatches: [batch('b1', [ticketType('t1')])] },
      new Map(),
      now,
    );

    expect(sales.batches[0].ticketTypes[0].revenue).toBe(0);
    expect(sales.totals.revenue).toBe(0);
  });

  it('cada tanda trae su estado de venta calculado', () => {
    const sales = buildEventSales(
      {
        endDate: eventEnd,
        ticketBatches: [
          { ...batch('b1', [ticketType('t1')]), isVisible: false },
          batch('b2', [ticketType('t2', { stock: 5, sold: 5 })]),
        ],
      },
      new Map(),
      now,
    );

    expect(sales.batches.map(({ saleStatus }) => saleStatus)).toEqual([
      'HIDDEN',
      'SOLD_OUT',
    ]);
  });
});
