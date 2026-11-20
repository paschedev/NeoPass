import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

function directive(policy: string, name: string): string[] {
  const found = policy
    .split('; ')
    .find((part) => part.startsWith(`${name} `));
  return found ? found.split(' ').slice(1) : [];
}

describe('securityHeaders', () => {
  const headers = securityHeaders({ apiUrl: 'https://api.neopass.ar' });
  const value = (key: string) => headers.find((h) => h.key === key)?.value;

  it('la política de contenido va en solo reporte, sin bloquear', () => {
    expect(value('Content-Security-Policy-Report-Only')).toBeDefined();
    expect(value('Content-Security-Policy')).toBeUndefined();
  });

  it('nadie puede meter NeoPass en un iframe', () => {
    expect(value('X-Frame-Options')).toBe('DENY');
    expect(
      directive(value('Content-Security-Policy-Report-Only')!, 'frame-ancestors'),
    ).toEqual(["'none'"]);
  });

  it('el navegador no adivina tipos de archivo', () => {
    expect(value('X-Content-Type-Options')).toBe('nosniff');
  });

  it('el origen sigue viajando a Google Maps, que reconoce la clave por él', () => {
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('la cámara queda solo para NeoPass, sin micrófono ni ubicación', () => {
    expect(value('Permissions-Policy')).toBe(
      'camera=(self), microphone=(), geolocation=()',
    );
  });
});

describe('contentSecurityPolicy', () => {
  const policy = contentSecurityPolicy({ apiUrl: 'https://api.neopass.ar/' });

  it('deja hablar con la API por su origen', () => {
    expect(directive(policy, 'connect-src')).toContain('https://api.neopass.ar');
  });

  it('permite los servicios externos que usa NeoPass', () => {
    expect(directive(policy, 'script-src')).toEqual(
      expect.arrayContaining([
        'https://accounts.google.com',
        'https://maps.googleapis.com',
        'https://challenges.cloudflare.com',
      ]),
    );
    expect(directive(policy, 'frame-src')).toEqual(
      expect.arrayContaining([
        'https://accounts.google.com',
        'https://www.google.com',
        'https://challenges.cloudflare.com',
        'https://www.youtube-nocookie.com',
      ]),
    );
    expect(directive(policy, 'img-src')).toContain('https://res.cloudinary.com');
    expect(directive(policy, 'connect-src')).toEqual(
      expect.arrayContaining([
        'https://api.cloudinary.com',
        'https://fastly.jsdelivr.net',
      ]),
    );
  });

  it('cierra plugins, la base de los links y los formularios a otros sitios', () => {
    expect(directive(policy, 'object-src')).toEqual(["'none'"]);
    expect(directive(policy, 'base-uri')).toEqual(["'self'"]);
    expect(directive(policy, 'form-action')).toEqual(["'self'"]);
  });

  it('eval solo en desarrollo', () => {
    expect(directive(policy, 'script-src')).not.toContain("'unsafe-eval'");
    expect(
      directive(contentSecurityPolicy({ development: true }), 'script-src'),
    ).toContain("'unsafe-eval'");
  });

  it('sin una URL de API válida no agrega orígenes de más', () => {
    const withoutApi = contentSecurityPolicy({ apiUrl: 'no es una url' });
    expect(directive(withoutApi, 'connect-src')).not.toContain('no');
  });
});
