import { Prisma } from '@prisma/client';
import { getBatchSaleStatus } from './batch-sale-status';

type SalesTicketType = {
  id: string;
  name: string;
  price: Prisma.Decimal;
  stock: number;
  sold: number;
  reserved: number;
};

type SalesEvent = {
  endDate: Date;
  ticketBatches: {
    id: string;
    name: string;
    isVisible: boolean;
    publishAt: Date | null;
    closeAt: Date | null;
    ticketTypes: SalesTicketType[];
  }[];
};

const ZERO = new Prisma.Decimal(0);

// Sales of an event as its organizer reads them. Revenue is what buyers paid
// for each ticket type (by paid order), so a later price change doesn't
// rewrite it; the current price is shown apart.
export function buildEventSales(
  event: SalesEvent,
  revenueByTicketType: Map<string, Prisma.Decimal>,
  now: Date,
) {
  let revenue = ZERO;
  let sold = 0;
  let reserved = 0;
  let capacity = 0;

  const batches = event.ticketBatches.map(({ ticketTypes, ...batch }) => ({
    id: batch.id,
    name: batch.name,
    saleStatus: getBatchSaleStatus(
      { ...batch, ticketTypes },
      event.endDate,
      now,
    ),
    ticketTypes: ticketTypes.map((ticketType) => {
      const typeRevenue = revenueByTicketType.get(ticketType.id) ?? ZERO;
      revenue = revenue.add(typeRevenue);
      sold += ticketType.sold;
      reserved += ticketType.reserved;
      capacity += ticketType.stock;
      return {
        id: ticketType.id,
        name: ticketType.name,
        price: ticketType.price.toNumber(),
        stock: ticketType.stock,
        sold: ticketType.sold,
        reserved: ticketType.reserved,
        available: Math.max(
          0,
          ticketType.stock - ticketType.sold - ticketType.reserved,
        ),
        revenue: typeRevenue.toNumber(),
      };
    }),
  }));

  return {
    totals: { revenue: revenue.toNumber(), sold, reserved, capacity },
    batches,
  };
}
