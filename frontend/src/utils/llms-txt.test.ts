// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildLlmsTxt } from './llms-txt';

const events = {
  items: [
    {
      id: 'a6128596-1ce0-4eb3-ad48-bee3c935448a',
      title: 'Techno Night [sold out]',
      imageUrl: null,
      // Sábado 12 de diciembre a las 23:00 en Argentina.
      startDate: '2026-12-13T02:00:00.000Z',
      endDate: '2026-12-13T09:00:00.000Z',
      venueName: 'Club Central',
    },
  ],
  total: 1,
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.neopass.ar');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Guía para buscadores con IA (/llms.txt)', () => {
  it('dice qué es NeoPass y lleva a sus páginas clave', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(events)));

    const text = await buildLlmsTxt(600);

    expect(text.startsWith('# NeoPass\n\n> Ticketera argentina')).toBe(true);
    expect(text).toContain(
      '- [Para organizadores](https://neopass.ar/organizadores)',
    );
    expect(text).toContain(
      '- [Preguntas frecuentes](https://neopass.ar/preguntas-frecuentes)',
    );
    expect(text).toContain('- Correo: soporte@neopass.ar');
  });

  it('lista los próximos eventos con fecha en hora de Argentina, lugar y link', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(events)));

    const text = await buildLlmsTxt(600);

    expect(text).toContain(
      '- [Techno Night sold out](https://neopass.ar/eventos/a6128596-1ce0-4eb3-ad48-bee3c935448a): sáb, 12 dic, 23:00 hs · Club Central',
    );
  });

  it('trae las preguntas frecuentes con sus respuestas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(events)));

    const text = await buildLlmsTxt(600);

    expect(text).toContain('**¿Cuánto cuesta usar NeoPass?**');
    expect(text).toContain(
      'Sin abono ni costo de alta. El cargo de servicio lo paga quien compra.',
    );
  });

  it('si la API falla, manda a ver la lista en /eventos', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('x')));

    const text = await buildLlmsTxt(600);

    expect(text).toContain('- La lista al día está en https://neopass.ar/eventos');
  });
});
