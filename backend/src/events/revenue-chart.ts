import { Prisma } from '@prisma/client';

const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires';
const CHART_DAYS = 30;
// Argentina has no daylight saving time: a day is always 24 h.
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

interface ChartOrder {
  createdAt: Date;
  orderItems: {
    quantity: number;
    unitPrice: Prisma.Decimal | number;
    ticketType: { eventId: string };
  }[];
}

// Organizer revenue (ticket face value, without the NeoPass fee) per day of
// the last 30 days, with days as organizers live them: Argentina time.
export function buildRevenueChart(
  orders: ChartOrder[],
  eventIds: string[],
  now: Date,
) {
  const revenueByDay = new Map<string, number>();
  for (let daysAgo = CHART_DAYS - 1; daysAgo >= 0; daysAgo--) {
    revenueByDay.set(dayFormat.format(now.getTime() - daysAgo * DAY_MS), 0);
  }

  for (const order of orders) {
    const day = dayFormat.format(order.createdAt);
    const current = revenueByDay.get(day);
    if (current === undefined) continue;

    const revenue = order.orderItems
      .filter((item) => eventIds.includes(item.ticketType.eventId))
      .reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);
    revenueByDay.set(day, current + revenue);
  }

  return [...revenueByDay].map(([date, revenue]) => ({ date, revenue }));
}
