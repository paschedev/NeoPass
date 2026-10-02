import { planBatchSaleAction } from './batch-sale-action';

const now = new Date('2026-10-10T23:00:00.000Z');
const at = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);

const batch = (overrides = {}) => ({
  isVisible: true,
  publishAt: null,
  closeAt: null,
  ...overrides,
});

describe('planBatchSaleAction', () => {
  describe('finalizar la venta', () => {
    it('la venta termina ahora y conserva un inicio que ya pasó', () => {
      expect(
        planBatchSaleAction(batch({ publishAt: at(-5) }), 'END', now),
      ).toEqual({ publishAt: at(-5), closeAt: now });
    });

    it('reemplaza un fin de venta programado para más adelante', () => {
      expect(
        planBatchSaleAction(batch({ closeAt: at(5) }), 'END', now),
      ).toEqual({ publishAt: null, closeAt: now });
    });

    it('descarta un inicio todavía futuro, para que la tanda no empiece después de terminar', () => {
      expect(
        planBatchSaleAction(batch({ publishAt: at(5) }), 'END', now),
      ).toEqual({ publishAt: null, closeAt: now });
    });

    it('no hay nada que finalizar si la venta ya terminó', () => {
      expect(
        planBatchSaleAction(batch({ closeAt: at(-1) }), 'END', now),
      ).toBeNull();
    });
  });

  describe('reabrir la venta', () => {
    it('una tanda finalizada vuelve a venderse hasta el fin del evento', () => {
      expect(
        planBatchSaleAction(batch({ closeAt: at(-1) }), 'REOPEN', now),
      ).toEqual({ closeAt: null });
    });

    it('no toca una tanda que sigue vendiendo, aunque tenga un fin programado', () => {
      expect(
        planBatchSaleAction(batch({ closeAt: at(5) }), 'REOPEN', now),
      ).toBeNull();
      expect(planBatchSaleAction(batch(), 'REOPEN', now)).toBeNull();
    });
  });

  describe('ocultar y mostrar', () => {
    it('oculta una tanda visible y muestra una oculta', () => {
      expect(planBatchSaleAction(batch(), 'HIDE', now)).toEqual({
        isVisible: false,
      });
      expect(
        planBatchSaleAction(batch({ isVisible: false }), 'SHOW', now),
      ).toEqual({ isVisible: true });
    });

    it('no hay nada que cambiar si ya está en ese estado', () => {
      expect(
        planBatchSaleAction(batch({ isVisible: false }), 'HIDE', now),
      ).toBeNull();
      expect(planBatchSaleAction(batch(), 'SHOW', now)).toBeNull();
    });
  });
});
