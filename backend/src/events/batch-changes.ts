import { BatchDto } from './dto/batch.dto';

type StoredBatch = { id: string; ticketTypes: { id: string }[] };

export type TicketTypeWrite = {
  id?: string;
  name: string;
  price: number;
  stock: number;
};

export type BatchWrite = {
  id?: string;
  name: string;
  isVisible: boolean;
  publishAt: Date | null;
  closeAt: Date | null;
  publishWhenPreviousSoldOut: boolean;
  ticketTypes: TicketTypeWrite[];
};

export type BatchChanges = {
  // Deleting a batch also deletes its ticket types.
  deletedBatchIds: string[];
  deletedTicketTypeIds: string[];
  // Without an id it is created; with one, updated.
  batches: BatchWrite[];
};

// The client sends the full list of batches: whatever is stored and missing
// from it is deleted. IDs must already be checked to belong to the event.
export function planBatchChanges(
  stored: StoredBatch[],
  incoming: BatchDto[],
): BatchChanges {
  const incomingBatchIds = new Set(incoming.map((batch) => batch.id));
  const storedTypesByBatch = new Map(
    stored.map((batch) => [batch.id, batch.ticketTypes]),
  );

  return {
    deletedBatchIds: stored
      .filter((batch) => !incomingBatchIds.has(batch.id))
      .map((batch) => batch.id),
    deletedTicketTypeIds: incoming.flatMap((batch) => {
      const keptTypeIds = new Set(batch.ticketTypes.map((type) => type.id));
      const storedTypes = batch.id ? storedTypesByBatch.get(batch.id) : [];
      return (storedTypes ?? [])
        .filter((type) => !keptTypeIds.has(type.id))
        .map((type) => type.id);
    }),
    batches: incoming.map((batch) => ({
      id: batch.id,
      name: batch.name,
      isVisible: batch.isVisible,
      publishAt: batch.publishAt ? new Date(batch.publishAt) : null,
      closeAt: batch.closeAt ? new Date(batch.closeAt) : null,
      publishWhenPreviousSoldOut: batch.publishWhenPreviousSoldOut ?? false,
      ticketTypes: batch.ticketTypes.map((type) => ({
        id: type.id,
        name: type.name,
        price: type.price,
        stock: type.stock,
      })),
    })),
  };
}
