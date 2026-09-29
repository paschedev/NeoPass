import { describe, expect, it } from 'vitest';
import {
  defaultSaleEnd,
  defaultSaleStart,
  endBatchSaleNow,
  getBatchSaleStatus,
} from './batches';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-01T20:00:00Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

function batch(overrides: Partial<Parameters<typeof getBatchSaleStatus>[0]>) {
  return {
    isVisible: true,
    publishAt: null,
    closeAt: null,
    ticketTypes: [{ stock: 100 }],
    ...overrides,
  };
}

describe('getBatchSaleStatus', () => {
  it('una tanda visible, sin fechas y con entradas está a la venta', () => {
    expect(getBatchSaleStatus(batch({}), now)).toBe('ON_SALE');
  });

  it('una tanda oculta se ve oculta aunque esté en fecha', () => {
    expect(getBatchSaleStatus(batch({ isVisible: false }), now)).toBe('HIDDEN');
  });

  it('antes de su inicio de venta está próximamente', () => {
    expect(getBatchSaleStatus(batch({ publishAt: at(1) }), now)).toBe(
      'UPCOMING',
    );
  });

  it('desde su fin de venta está finalizada', () => {
    expect(getBatchSaleStatus(batch({ closeAt: at(0) }), now)).toBe('ENDED');
  });

  it('con todo vendido o reservado está agotada', () => {
    const soldOut = batch({
      ticketTypes: [{ stock: 10, sold: 7, reserved: 3 }],
    });

    expect(getBatchSaleStatus(soldOut, now)).toBe('SOLD_OUT');
  });
});

describe('endBatchSaleNow', () => {
  it('termina la venta en este momento', () => {
    expect(endBatchSaleNow(batch({ closeAt: at(5) }), now).closeAt).toBe(
      now.toISOString(),
    );
  });

  it('conserva un inicio de venta que ya pasó', () => {
    expect(endBatchSaleNow(batch({ publishAt: at(-5) }), now).publishAt).toBe(
      at(-5),
    );
  });

  it('descarta un inicio de venta futuro, así la tanda queda finalizada', () => {
    const ended = endBatchSaleNow(batch({ publishAt: at(5) }), now);

    expect(ended.publishAt).toBeNull();
    expect(getBatchSaleStatus(ended, now)).toBe('ENDED');
  });
});

describe('fechas sugeridas al activar la ventana de venta', () => {
  it('el inicio de venta sugerido es dentro de una hora', () => {
    expect(defaultSaleStart(now)).toBe(at(1));
  });

  it('el fin de venta sugerido es un día después del inicio', () => {
    expect(defaultSaleEnd(at(3), now)).toBe(at(27));
  });

  it('sin inicio de venta, o con uno pasado, el fin sugerido es en un día', () => {
    expect(defaultSaleEnd(null, now)).toBe(at(24));
    expect(defaultSaleEnd(at(-3), now)).toBe(at(24));
  });
});
