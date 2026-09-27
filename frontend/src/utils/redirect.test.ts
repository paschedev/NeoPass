import { describe, expect, it } from 'vitest';
import { getSafeRedirect } from './redirect';

describe('getSafeRedirect', () => {
  it('acepta una ruta interna con su query', () => {
    expect(getSafeRedirect('/eventos/abc?rpp=123')).toBe(
      '/eventos/abc?rpp=123',
    );
  });

  it('sin callback no redirige', () => {
    expect(getSafeRedirect(null)).toBeNull();
    expect(getSafeRedirect('')).toBeNull();
  });

  it('rechaza una URL de otro sitio', () => {
    expect(getSafeRedirect('https://evil.example/panel')).toBeNull();
  });

  it('rechaza una URL sin protocolo que apunta a otro dominio', () => {
    expect(getSafeRedirect('//evil.example')).toBeNull();
  });

  it('rechaza la variante con barra invertida', () => {
    expect(getSafeRedirect('/\\evil.example')).toBeNull();
  });

  it('rechaza caracteres de control que el navegador descarta', () => {
    expect(getSafeRedirect('/\t/evil.example')).toBeNull();
  });

  it('rechaza javascript:', () => {
    expect(getSafeRedirect('javascript:alert(document.cookie)')).toBeNull();
  });
});
