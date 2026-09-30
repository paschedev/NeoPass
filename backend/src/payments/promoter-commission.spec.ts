import { Prisma } from '@prisma/client';
import { calculatePromoterCommission } from './promoter-commission';

function commission(
  commissionType: 'PERCENTAGE' | 'FIXED' | null,
  commissionValue: number | null,
  ticketAmount: number,
  ticketCount: number,
) {
  return calculatePromoterCommission(
    {
      commissionType,
      commissionValue:
        commissionValue === null ? null : new Prisma.Decimal(commissionValue),
    },
    { ticketAmount, ticketCount },
  ).toFixed(2);
}

describe('calculatePromoterCommission', () => {
  it('una comisión porcentual es ese porcentaje del valor de las entradas', () => {
    expect(commission('PERCENTAGE', 10, 2000, 2)).toBe('200.00');
  });

  it('una comisión fija se paga por cada entrada', () => {
    expect(commission('FIXED', 500, 2000, 2)).toBe('1000.00');
  });

  it('se redondea a centavos, con la mitad hacia arriba', () => {
    // 7,5 % de $333,33 = $24,999975
    expect(commission('PERCENTAGE', 7.5, 333.33, 1)).toBe('25.00');
    // 12,5 % de $0,20 = $0,025
    expect(commission('PERCENTAGE', 12.5, 0.2, 1)).toBe('0.03');
  });

  it('sin comisión configurada el RPP no gana nada', () => {
    expect(commission(null, null, 2000, 2)).toBe('0.00');
    expect(commission('PERCENTAGE', null, 2000, 2)).toBe('0.00');
  });
});
