import { describe, expect, it, vi } from 'vitest';
import { copyLink, eventLink } from './share';

const withClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  });

describe('eventLink', () => {
  it('es la página pública del evento, sin rpp: no le suma ventas a ningún RPP', () => {
    expect(eventLink('https://neopass.ar', 'e1')).toBe(
      'https://neopass.ar/eventos/e1',
    );
  });
});

// El aviso lo da el botón (CopyLinkButton), no un toast.
describe('copyLink', () => {
  it('copia el link y dice que se pudo', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('https://neopass.ar/eventos/e1');
  });

  it('si el navegador no deja copiar, dice que no se pudo', async () => {
    withClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(
      false,
    );
  });

  it('sin portapapeles (fuera de HTTPS) también dice que no se pudo', async () => {
    withClipboard(undefined);

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(
      false,
    );
  });
});
