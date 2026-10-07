import { afterEach, describe, expect, it, vi } from 'vitest';
import toast from './toast';
import { copyLink, eventLink } from './share';

vi.mock('./toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

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

describe('copyLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('copia el link y avisa que quedó copiado', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('https://neopass.ar/eventos/e1');
    expect(toast.success).toHaveBeenCalledWith('Link copiado');
  });

  it('si el navegador no deja copiar, avisa que no se pudo y nunca dice "copiado"', async () => {
    withClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(
      false,
    );

    expect(toast.error).toHaveBeenCalledWith('No se pudo copiar el link');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('sin portapapeles (fuera de HTTPS) también avisa que no se pudo', async () => {
    withClipboard(undefined);

    await expect(copyLink('https://neopass.ar/eventos/e1')).resolves.toBe(
      false,
    );

    expect(toast.error).toHaveBeenCalledWith('No se pudo copiar el link');
  });
});
