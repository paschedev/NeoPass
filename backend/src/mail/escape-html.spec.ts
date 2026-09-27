import { escapeHtml } from './escape-html';

describe('escapeHtml', () => {
  it('escapa los caracteres que el HTML interpreta', () => {
    expect(escapeHtml(`<script>alert("x" & 'y')</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;',
    );
  });

  it('deja igual un texto sin caracteres especiales', () => {
    expect(escapeHtml('Fiesta de Primavera 2026')).toBe(
      'Fiesta de Primavera 2026',
    );
  });
});
