// A cell that starts with one of these is run as a formula by Excel/Sheets.
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Quotes a value for a CSV cell and neutralizes spreadsheet formulas: buyer
 * names are typed by users and could otherwise run when the file is opened.
 */
export function toCsvCell(value: string | number): string {
  let text = String(value);
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }
  return `"${text.replace(/"/g, '""')}"`;
}
