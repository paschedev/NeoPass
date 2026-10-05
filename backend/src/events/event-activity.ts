import { Prisma } from '@prisma/client';

// One line of an event's history. Each repository writes it in the same
// transaction as the change it describes.
export type ActivityEntry = Omit<
  Prisma.EventActivityUncheckedCreateInput,
  'id' | 'createdAt'
>;
