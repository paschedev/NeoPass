import { Prisma } from '@prisma/client';
import {
  eventSalesNotice,
  promoterSalesNotice,
  purchaseNotice,
} from './sale-notices';

const pesos = (amount: string) => new Prisma.Decimal(amount);

describe('textos de los avisos de venta', () => {
  describe('ventas del evento', () => {
    it('nombra el evento y suma entradas y lo cobrado', () => {
      expect(
        eventSalesNotice('Fiesta X', { tickets: 14, amount: pesos('140000') }),
      ).toEqual({
        title: 'Ventas de Fiesta X',
        message: 'Se vendieron 14 entradas nuevas: $140.000.',
      });
    });

    it('una sola entrada va en singular', () => {
      expect(
        eventSalesNotice('Fiesta X', { tickets: 1, amount: pesos('1500') })
          .message,
      ).toBe('Se vendió 1 entrada nueva: $1.500.');
    });

    it('muestra los centavos si los hay', () => {
      expect(
        eventSalesNotice('Fiesta X', { tickets: 2, amount: pesos('2469.5') })
          .message,
      ).toBe('Se vendieron 2 entradas nuevas: $2.469,50.');
    });
  });

  describe('ventas del RPP', () => {
    it('dice cuántas vendió con su link y cuánto ganó', () => {
      expect(
        promoterSalesNotice('Fiesta X', { tickets: 3, amount: pesos('4500') }),
      ).toEqual({
        title: 'Tus ventas en Fiesta X',
        message: 'Vendiste 3 entradas con tu link: ganaste $4.500.',
      });
    });

    it('sin comisión no habla de ganancias', () => {
      expect(
        promoterSalesNotice('Fiesta X', { tickets: 1, amount: pesos('0') })
          .message,
      ).toBe('Vendiste 1 entrada con tu link.');
    });
  });

  describe('compra confirmada', () => {
    it('varias entradas', () => {
      expect(purchaseNotice('Fiesta X', 2)).toEqual({
        title: 'Compra confirmada',
        message: 'Tus 2 entradas para Fiesta X ya están en Mis entradas.',
      });
    });

    it('una entrada', () => {
      expect(purchaseNotice('Fiesta X', 1).message).toBe(
        'Tu entrada para Fiesta X ya está en Mis entradas.',
      );
    });
  });
});
