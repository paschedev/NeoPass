import { describe, expect, it } from 'vitest';
import {
  defaultSaleEnd,
  defaultSaleStart,
  getBatchSaleActions,
  getBatchSaleStatus,
  getBatchWindowErrors,
  getSimultaneousBatches,
  saleEndsOnSave,
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

describe('getBatchSaleActions', () => {
  it('una tanda que vende, o que todavía no empezó, se puede finalizar', () => {
    expect(getBatchSaleActions(batch({}), now, false)).toEqual(['END']);
    expect(getBatchSaleActions(batch({ closeAt: at(5) }), now, false)).toEqual([
      'END',
    ]);
    expect(
      getBatchSaleActions(batch({ publishAt: at(5) }), now, false),
    ).toEqual(['END']);
  });

  it('una tanda con la venta finalizada se puede reabrir', () => {
    expect(getBatchSaleActions(batch({ closeAt: at(-1) }), now, false)).toEqual(
      ['REOPEN'],
    );
  });

  it('con el evento en curso además se puede ocultar o mostrar', () => {
    expect(getBatchSaleActions(batch({}), now, true)).toEqual(['END', 'HIDE']);
    expect(
      getBatchSaleActions(
        batch({ isVisible: false, closeAt: at(-1) }),
        now,
        true,
      ),
    ).toEqual(['REOPEN', 'SHOW']);
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

describe('getBatchWindowErrors', () => {
  const eventEnd = new Date(at(48));
  const window = (publishAt: string | null, closeAt: string | null) => ({
    publishAt,
    closeAt,
  });

  it('acepta una ventana de venta dentro del evento', () => {
    expect(
      getBatchWindowErrors(window(at(1), at(24)), { eventEnd, now }),
    ).toEqual({});
    expect(getBatchWindowErrors(window(null, null), { eventEnd, now })).toEqual(
      {},
    );
  });

  it('el fin de venta no puede ser posterior al fin del evento', () => {
    expect(
      getBatchWindowErrors(window(null, at(49)), { eventEnd, now }),
    ).toEqual({ closeAt: 'No puede ser después del fin del evento' });
  });

  it('el inicio de venta tiene que ser anterior al fin de venta', () => {
    expect(
      getBatchWindowErrors(window(at(24), at(24)), { eventEnd, now }),
    ).toEqual({ publishAt: 'Tiene que ser anterior al fin de venta' });
  });

  it('sin fin de venta, el inicio tiene que ser anterior al fin del evento', () => {
    expect(
      getBatchWindowErrors(window(at(48), null), { eventEnd, now }),
    ).toEqual({ publishAt: 'Tiene que ser anterior al fin del evento' });
  });

  it('un inicio de venta nuevo que ya pasó se rechaza, pero el guardado sin cambios se acepta', () => {
    expect(
      getBatchWindowErrors(window(at(-1), null), { eventEnd, now }),
    ).toEqual({ publishAt: 'Esta fecha ya pasó' });
    expect(
      getBatchWindowErrors(window(at(-1), null), {
        eventEnd,
        now,
        savedPublishAt: at(-1),
      }),
    ).toEqual({});
  });

  it('un fin de venta que ya pasó se acepta: así se finaliza la tanda', () => {
    expect(
      getBatchWindowErrors(window(null, at(-1)), { eventEnd, now }),
    ).toEqual({});
  });

  it('sin fin del evento elegido solo compara las fechas de la tanda', () => {
    expect(
      getBatchWindowErrors(window(at(1), at(100)), { eventEnd: null, now }),
    ).toEqual({});
  });
});

describe('saleEndsOnSave', () => {
  it('avisa si el fin de venta elegido ya pasó', () => {
    expect(saleEndsOnSave({ closeAt: at(-1) }, undefined, now)).toBe(true);
    expect(saleEndsOnSave({ closeAt: at(1) }, undefined, now)).toBe(false);
    expect(saleEndsOnSave({ closeAt: null }, undefined, now)).toBe(false);
  });

  it('no avisa por una tanda que ya estaba finalizada', () => {
    expect(saleEndsOnSave({ closeAt: at(-5) }, at(-5), now)).toBe(false);
  });
});

describe('getSimultaneousBatches', () => {
  const eventEnd = new Date(at(48));
  const named = (
    name: string,
    publishAt: string | null,
    closeAt: string | null,
    isVisible = true,
  ) => ({ name, isVisible, publishAt, closeAt });

  it('avisa si dos tandas visibles se venden al mismo tiempo', () => {
    expect(
      getSimultaneousBatches(
        [named('Preventa', null, at(24)), named('General', at(12), null)],
        eventEnd,
        now,
      ),
    ).toEqual([['Preventa', 'General']]);
  });

  it('no avisa si una tanda empieza cuando termina la otra', () => {
    expect(
      getSimultaneousBatches(
        [named('Preventa', null, at(24)), named('General', at(24), null)],
        eventEnd,
        now,
      ),
    ).toEqual([]);
  });

  it('ignora las tandas ocultas y las que ya terminaron', () => {
    expect(
      getSimultaneousBatches(
        [
          named('Preventa', null, at(-1)),
          named('Invitados', null, null, false),
          named('General', null, null),
        ],
        eventEnd,
        now,
      ),
    ).toEqual([]);
  });
});
