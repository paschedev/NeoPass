import { describe, expect, it } from 'vitest';
import { toCsvCell } from './csv';

describe('toCsvCell', () => {
  it.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tdato'])(
    'neutraliza una fórmula al abrir el archivo: %s',
    (value) => {
      expect(toCsvCell(value).startsWith(`"'`)).toBe(true);
    },
  );

  it('escapa las comillas dobles', () => {
    expect(toCsvCell('Ana "la" Pérez')).toBe('"Ana ""la"" Pérez"');
  });

  it('deja igual un texto normal, entre comillas', () => {
    expect(toCsvCell('Juan Pérez')).toBe('"Juan Pérez"');
  });

  it('acepta números', () => {
    expect(toCsvCell(1500)).toBe('"1500"');
  });
});
