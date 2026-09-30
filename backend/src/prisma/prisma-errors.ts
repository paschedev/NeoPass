// The database CHECK `stock >= sold + reserved` rejected a write: there are no
// tickets left for it.
export function isStockLimitError(error: unknown) {
  return error instanceof Error && error.message.includes('check_stock_limits');
}
