export type SaleWindowStatus = 'HIDDEN' | 'UPCOMING' | 'OPEN' | 'ENDED';
export type BatchSaleStatus =
  | 'HIDDEN'
  | 'UPCOMING'
  | 'ON_SALE'
  | 'SOLD_OUT'
  | 'ENDED';

type SaleWindow = {
  isVisible: boolean;
  publishAt: Date | null;
  closeAt: Date | null;
};
type TicketStock = { stock: number; sold: number; reserved: number };

// Whether a batch can sell right now by its visibility and dates: it sells from
// publishAt (or right away) until closeAt (or the end of the event). Always
// computed on read, so no job has to move batches between states.
export function getSaleWindowStatus(
  batch: SaleWindow,
  eventEndDate: Date,
  now: Date,
): SaleWindowStatus {
  if (!batch.isVisible) return 'HIDDEN';
  if (now >= (batch.closeAt ?? eventEndDate)) return 'ENDED';
  if (batch.publishAt && now < batch.publishAt) return 'UPCOMING';
  return 'OPEN';
}

export function getBatchSaleStatus(
  batch: SaleWindow & { ticketTypes: TicketStock[] },
  eventEndDate: Date,
  now: Date,
): BatchSaleStatus {
  const window = getSaleWindowStatus(batch, eventEndDate, now);
  if (window !== 'OPEN') return window;
  const hasAvailable = batch.ticketTypes.some(
    ({ stock, sold, reserved }) => stock - sold - reserved > 0,
  );
  return hasAvailable ? 'ON_SALE' : 'SOLD_OUT';
}
