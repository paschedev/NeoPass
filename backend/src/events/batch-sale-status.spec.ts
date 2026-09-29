import { getBatchSaleStatus, getSaleWindowStatus } from './batch-sale-status';

const HOUR_MS = 60 * 60 * 1000;

describe('estado de venta de una tanda', () => {
  const now = new Date('2026-10-01T20:00:00Z');
  const eventEnd = new Date(now.getTime() + 48 * HOUR_MS);
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);

  function batch(
    overrides: Partial<{
      isVisible: boolean;
      publishAt: Date | null;
      closeAt: Date | null;
      ticketTypes: { stock: number; sold: number; reserved: number }[];
    }> = {},
  ) {
    return {
      isVisible: true,
      publishAt: null,
      closeAt: null,
      ticketTypes: [{ stock: 100, sold: 0, reserved: 0 }],
      ...overrides,
    };
  }

  it('sin fechas y con entradas disponibles está a la venta', () => {
    expect(getBatchSaleStatus(batch(), eventEnd, now)).toBe('ON_SALE');
  });

  it('una tanda oculta no se vende aunque esté en fecha y con entradas', () => {
    expect(getBatchSaleStatus(batch({ isVisible: false }), eventEnd, now)).toBe(
      'HIDDEN',
    );
  });

  it('antes de su inicio de venta está próximamente', () => {
    expect(getBatchSaleStatus(batch({ publishAt: at(1) }), eventEnd, now)).toBe(
      'UPCOMING',
    );
  });

  it('desde el momento exacto de su inicio de venta está a la venta', () => {
    expect(getBatchSaleStatus(batch({ publishAt: now }), eventEnd, now)).toBe(
      'ON_SALE',
    );
  });

  it('desde el momento exacto de su fin de venta está finalizada', () => {
    expect(getBatchSaleStatus(batch({ closeAt: now }), eventEnd, now)).toBe(
      'ENDED',
    );
  });

  it('sin fin de venta, la venta termina cuando termina el evento', () => {
    expect(getBatchSaleStatus(batch(), now, now)).toBe('ENDED');
  });

  it('con todas las entradas vendidas o reservadas está agotada', () => {
    const soldOut = batch({
      ticketTypes: [
        { stock: 10, sold: 7, reserved: 3 },
        { stock: 5, sold: 5, reserved: 0 },
      ],
    });

    expect(getBatchSaleStatus(soldOut, eventEnd, now)).toBe('SOLD_OUT');
  });

  it('si queda al menos una entrada disponible sigue a la venta', () => {
    const almost = batch({
      ticketTypes: [
        { stock: 10, sold: 10, reserved: 0 },
        { stock: 5, sold: 4, reserved: 0 },
      ],
    });

    expect(getBatchSaleStatus(almost, eventEnd, now)).toBe('ON_SALE');
  });

  it('una tanda finalizada se ve finalizada aunque esté agotada', () => {
    const endedAndSoldOut = batch({
      closeAt: at(-1),
      ticketTypes: [{ stock: 10, sold: 10, reserved: 0 }],
    });

    expect(getBatchSaleStatus(endedAndSoldOut, eventEnd, now)).toBe('ENDED');
  });

  it('una tanda oculta se ve oculta aunque ya haya terminado', () => {
    expect(
      getBatchSaleStatus(
        batch({ isVisible: false, closeAt: at(-1) }),
        eventEnd,
        now,
      ),
    ).toBe('HIDDEN');
  });

  it('la ventana de venta no mira el stock', () => {
    const soldOut = batch({
      ticketTypes: [{ stock: 1, sold: 1, reserved: 0 }],
    });

    expect(getSaleWindowStatus(soldOut, eventEnd, now)).toBe('OPEN');
  });
});
