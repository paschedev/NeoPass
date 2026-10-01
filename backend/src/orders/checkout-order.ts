import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { getSaleWindowStatus } from '../events/batch-sale-status';
import type { PreferenceItem } from '../payments/payments.service';

export type CheckoutTicketType = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  sold: number;
  reserved: number;
  batch: {
    isVisible: boolean;
    publishAt: Date | null;
    closeAt: Date | null;
  } | null;
  event: {
    id: string;
    title: string;
    status: EventStatus;
    endDate: Date;
    neoPassFeePercentage: Prisma.Decimal;
  };
};

export type CheckoutOrderItem = {
  ticketTypeId: string;
  quantity: number;
  unitPrice: Prisma.Decimal;
};

// Every price in NeoPass is in Argentine pesos.
const CURRENCY_ID = 'ARS';

// Checks that every requested ticket can be sold right now and prices the
// order with the database values: the tickets, NeoPass's service fee (rounded
// to cents) and the items Mercado Pago charges. The stock check here gives the
// buyer a clear answer; the database CHECK is what prevents overselling.
export function buildCheckoutOrder<T extends CheckoutTicketType>(
  items: { ticketTypeId: string; quantity: number }[],
  ticketTypes: T[],
  now: Date,
) {
  const ticketTypesById = new Map(ticketTypes.map((type) => [type.id, type]));
  let event: T['event'] | undefined;
  let ticketAmount = new Prisma.Decimal(0);
  const orderItems: CheckoutOrderItem[] = [];
  const mpItems: PreferenceItem[] = [];

  for (const item of items) {
    const ticketType = ticketTypesById.get(item.ticketTypeId);
    if (!ticketType) {
      throw new NotFoundException('La entrada seleccionada no existe.');
    }
    // One order = one event: the fee and the organizer who gets paid come from it.
    if (event && event.id !== ticketType.event.id) {
      throw new BadRequestException(
        'Una orden solo puede tener entradas de un evento.',
      );
    }
    event = ticketType.event;

    if (event.status !== 'PUBLISHED') {
      throw new ConflictException('El evento no está a la venta.');
    }
    if (event.endDate < now) {
      throw new ConflictException('El evento ya terminó.');
    }
    if (
      !ticketType.batch ||
      getSaleWindowStatus(ticketType.batch, event.endDate, now) !== 'OPEN'
    ) {
      throw new ConflictException(
        'Esta tanda no está a la venta en este momento.',
      );
    }
    const available = ticketType.stock - ticketType.sold - ticketType.reserved;
    if (available < item.quantity) {
      throw new ConflictException(
        `No quedan suficientes entradas de ${ticketType.name}.`,
      );
    }

    ticketAmount = ticketAmount.add(ticketType.price.mul(item.quantity));
    orderItems.push({
      ticketTypeId: ticketType.id,
      quantity: item.quantity,
      unitPrice: ticketType.price,
    });
    mpItems.push({
      id: ticketType.id,
      title: `${event.title} - ${ticketType.name}`,
      quantity: item.quantity,
      unit_price: ticketType.price.toNumber(),
      currency_id: CURRENCY_ID,
    });
  }

  // The DTO already rejects an empty order.
  if (!event) throw new BadRequestException('Elegí al menos una entrada');

  const serviceFee = ticketAmount
    .mul(event.neoPassFeePercentage)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  mpItems.push({
    id: 'service_fee',
    title: 'Cargo por servicio',
    quantity: 1,
    unit_price: serviceFee.toNumber(),
    currency_id: CURRENCY_ID,
  });

  return {
    event,
    ticketAmount,
    serviceFee,
    totalAmount: ticketAmount.add(serviceFee),
    orderItems,
    mpItems,
  };
}
