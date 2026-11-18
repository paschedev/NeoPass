import { Prisma } from '@prisma/client';

// The database CHECK `stock >= sold + reserved` rejected a write: there are no
// tickets left for it.
export function isStockLimitError(error: unknown) {
  return error instanceof Error && error.message.includes('check_stock_limits');
}

// The database couldn't serve the request in time: no free connection in the
// pool (P2024) or the transaction ran out of time, usually waiting for a row
// that another purchase or payment holds (P2028).
const DATABASE_BUSY_CODES = new Set(['P2024', 'P2028']);

export function isDatabaseBusyError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    DATABASE_BUSY_CODES.has(error.code)
  );
}

export function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
