export type BatchSaleStatus =
  | 'HIDDEN'
  | 'UPCOMING'
  | 'ON_SALE'
  | 'SOLD_OUT'
  | 'ENDED';

type SaleWindow = { publishAt: string | null; closeAt: string | null };

type BatchForStatus = SaleWindow & {
  isVisible: boolean;
  ticketTypes: { stock: number; sold?: number; reserved?: number }[];
};

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const BATCH_STATUS_BADGES: Record<
  BatchSaleStatus,
  { label: string; className: string }
> = {
  HIDDEN: { label: 'Oculta', className: 'bg-white/10 text-neutral-400' },
  UPCOMING: {
    label: 'Próximamente',
    className: 'bg-indigo-500/10 text-indigo-300',
  },
  ON_SALE: {
    label: 'A la venta',
    className: 'bg-emerald-500/10 text-emerald-400',
  },
  SOLD_OUT: { label: 'Agotada', className: 'bg-amber-500/10 text-amber-400' },
  ENDED: { label: 'Finalizada', className: 'bg-red-500/10 text-red-400' },
};

// Espejo del cálculo del backend (src/events/batch-sale-status.ts) para mostrar
// el estado mientras se edita; lo que se vende lo decide el backend. El editor
// no conoce el fin del evento: una tanda sin fin de venta se ve a la venta.
export function getBatchSaleStatus(
  batch: BatchForStatus,
  now: Date,
): BatchSaleStatus {
  if (!batch.isVisible) return 'HIDDEN';
  if (batch.closeAt && now >= new Date(batch.closeAt)) return 'ENDED';
  if (batch.publishAt && now < new Date(batch.publishAt)) return 'UPCOMING';
  const hasAvailable = batch.ticketTypes.some(
    ({ stock, sold = 0, reserved = 0 }) => stock - sold - reserved > 0,
  );
  return hasAvailable ? 'ON_SALE' : 'SOLD_OUT';
}

// "Finalizar venta ya": la venta termina ahora. Un inicio todavía futuro se
// descarta, porque si no la tanda empezaría después de terminar.
export function endBatchSaleNow<T extends SaleWindow>(batch: T, now: Date): T {
  const startsLater =
    batch.publishAt !== null && new Date(batch.publishAt) > now;
  return {
    ...batch,
    publishAt: startsLater ? null : batch.publishAt,
    closeAt: now.toISOString(),
  };
}

export function defaultSaleStart(now: Date): string {
  return new Date(now.getTime() + HOUR_MS).toISOString();
}

export function defaultSaleEnd(publishAt: string | null, now: Date): string {
  const start = publishAt ? new Date(publishAt) : now;
  const base = start > now ? start : now;
  return new Date(base.getTime() + DAY_MS).toISOString();
}
