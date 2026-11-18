import { Prisma } from '@prisma/client';
import { buildCheckoutOrder, CheckoutTicketType } from './checkout-order';

const now = new Date('2026-11-18T12:00:00.000Z');

function ticketType(id: string): CheckoutTicketType {
  return {
    id,
    name: `Entrada ${id}`,
    price: new Prisma.Decimal(1000),
    stock: 10,
    sold: 0,
    reserved: 0,
    batch: { isVisible: true, publishAt: null, closeAt: null },
    event: {
      id: 'evento',
      title: 'Fiesta',
      status: 'PUBLISHED',
      endDate: new Date('2026-11-20T08:00:00.000Z'),
      deletedAt: null,
      neoPassFeePercentage: new Prisma.Decimal(10),
      organizer: { mercadoPagoFeeRate: null },
    },
  };
}

describe('buildCheckoutOrder', () => {
  it('ordena las entradas de la compra siempre igual, venga como venga el pedido', () => {
    const types = [ticketType('b-vip'), ticketType('a-general')];

    const fromOneBuyer = buildCheckoutOrder(
      [
        { ticketTypeId: 'b-vip', quantity: 1 },
        { ticketTypeId: 'a-general', quantity: 2 },
      ],
      types,
      now,
    );
    const fromAnother = buildCheckoutOrder(
      [
        { ticketTypeId: 'a-general', quantity: 2 },
        { ticketTypeId: 'b-vip', quantity: 1 },
      ],
      types,
      now,
    );

    const ids = (order: typeof fromOneBuyer) =>
      order.orderItems.map((item) => item.ticketTypeId);
    expect(ids(fromOneBuyer)).toEqual(['a-general', 'b-vip']);
    expect(ids(fromAnother)).toEqual(['a-general', 'b-vip']);
  });
});
