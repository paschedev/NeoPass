import { Prisma } from '@prisma/client';
import { formatPesos } from '../common/amounts';

// What the sales notices say. They add up while unread, so they always speak
// of the totals since the last time the person read one.

export type SalesTotals = { tickets: number; amount: Prisma.Decimal };

const tickets = (count: number) =>
  count === 1 ? '1 entrada' : `${count} entradas`;

export function eventSalesNotice(eventTitle: string, totals: SalesTotals) {
  const amount = formatPesos(totals.amount.toNumber());
  return {
    title: `Ventas de ${eventTitle}`,
    message:
      totals.tickets === 1
        ? `Se vendió 1 entrada nueva: ${amount}.`
        : `Se vendieron ${totals.tickets} entradas nuevas: ${amount}.`,
  };
}

export function promoterSalesNotice(eventTitle: string, totals: SalesTotals) {
  const earned = totals.amount.gt(0)
    ? `: ganaste ${formatPesos(totals.amount.toNumber())}`
    : '';
  return {
    title: `Tus ventas en ${eventTitle}`,
    message: `Vendiste ${tickets(totals.tickets)} con tu link${earned}.`,
  };
}

export function purchaseNotice(eventTitle: string, ticketCount: number) {
  return {
    title: 'Compra confirmada',
    message:
      ticketCount === 1
        ? `Tu entrada para ${eventTitle} ya está en Mis entradas.`
        : `Tus ${ticketCount} entradas para ${eventTitle} ya están en Mis entradas.`,
  };
}
