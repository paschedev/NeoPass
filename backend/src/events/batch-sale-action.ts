export const BATCH_SALE_ACTIONS = ['END', 'REOPEN', 'HIDE', 'SHOW'] as const;
export type BatchSaleAction = (typeof BATCH_SALE_ACTIONS)[number];

type SaleWindow = {
  isVisible: boolean;
  publishAt: Date | null;
  closeAt: Date | null;
};

// What an action writes on the batch, or null when the batch is already in that
// state. These are the only batch changes allowed while the event is running:
// they never touch prices, stock or the orders already being paid.
export function planBatchSaleAction(
  batch: SaleWindow,
  action: BatchSaleAction,
  now: Date,
): Partial<SaleWindow> | null {
  const ended = batch.closeAt !== null && batch.closeAt <= now;
  switch (action) {
    case 'END':
      if (ended) return null;
      // A start still in the future is dropped: the batch can't start selling
      // after its sale ended.
      return {
        publishAt:
          batch.publishAt && batch.publishAt > now ? null : batch.publishAt,
        closeAt: now,
      };
    case 'REOPEN':
      return ended ? { closeAt: null } : null;
    case 'HIDE':
      return batch.isVisible ? { isVisible: false } : null;
    case 'SHOW':
      return batch.isVisible ? null : { isVisible: true };
  }
}
