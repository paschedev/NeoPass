import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import toast from '@/utils/toast';
import CopyLinkButton from './CopyLinkButton';

vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const LINK = 'https://neopass.ar/eventos/e1';

const withClipboard = (clipboard: unknown) =>
  Object.defineProperty(navigator, 'clipboard', {
    value: clipboard,
    configurable: true,
  });

function renderButton(ariaLabel?: string) {
  render(
    <CopyLinkButton
      link={() => LINK}
      ariaLabel={ariaLabel}
      className="px-4"
      idleClassName="bg-white/5"
    />,
  );
}

// Toca el botón y deja que termine la copia (una promesa del navegador).
async function tap(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

describe('CopyLinkButton', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('copia el link y el mismo botón confirma con "¡Copiado!"; a los 2 segundos vuelve', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    withClipboard({ writeText });
    renderButton();

    await tap('Copiar link');

    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(
      screen.getByRole('button', { name: '¡Copiado!' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Link copiado');
    expect(toast.success).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(
      screen.getByRole('button', { name: 'Copiar link' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('si el navegador no deja copiar, dice "No se copió" y nunca "copiado"', async () => {
    withClipboard({
      writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
    });
    renderButton();

    await tap('Copiar link');

    expect(
      screen.getByRole('button', { name: 'No se copió' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No se pudo copiar el link',
    );
    expect(
      screen.queryByRole('button', { name: '¡Copiado!' }),
    ).not.toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('con un nombre propio ("Copiar link de …"), al copiar se lee lo que muestra', async () => {
    withClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    renderButton('Copiar link de Techno Night');

    await tap('Copiar link de Techno Night');

    expect(
      screen.getByRole('button', { name: '¡Copiado!' }),
    ).toBeInTheDocument();
  });

  it('no cambia de tamaño: siempre guarda el lugar de los tres textos y muestra uno', async () => {
    withClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    renderButton();
    const labels = () =>
      [...screen.getByRole('button').querySelectorAll('[data-label]')].map(
        (label) => [label.textContent, label.getAttribute('aria-hidden')],
      );

    expect(labels()).toEqual([
      ['Copiar link', null],
      ['¡Copiado!', 'true'],
      ['No se copió', 'true'],
    ]);

    await tap('Copiar link');

    expect(labels()).toEqual([
      ['Copiar link', 'true'],
      ['¡Copiado!', null],
      ['No se copió', 'true'],
    ]);
  });

  it('tocarlo de nuevo reinicia los 2 segundos', async () => {
    withClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });
    renderButton();

    await tap('Copiar link');
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await tap('¡Copiado!');
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(
      screen.getByRole('button', { name: '¡Copiado!' }),
    ).toBeInTheDocument();
  });
});
