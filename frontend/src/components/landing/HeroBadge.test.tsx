import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import HeroBadge from './HeroBadge';

const BRAND = 'La nueva era de los eventos';
const PAYOUT = 'Cobrás directo en tu Mercado Pago';

describe('Etiqueta del hero', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('arranca con «La nueva era de los eventos» y cada 3,5 segundos pasa a la frase siguiente, hasta volver a empezar', () => {
    vi.useFakeTimers();
    render(<HeroBadge />);

    expect(screen.getByText(BRAND)).toBeVisible();
    expect(screen.getByText(PAYOUT)).not.toBeVisible();

    act(() => vi.advanceTimersByTime(3500));

    expect(screen.getByText(BRAND)).not.toBeVisible();
    expect(screen.getByText(PAYOUT)).toBeVisible();

    act(() => vi.advanceTimersByTime(3500 * 3));

    expect(screen.getByText(BRAND)).toBeVisible();
  });

  it('cuenta lo que el producto hace: cobro directo, RPPs con link y QR free', () => {
    render(<HeroBadge />);

    expect(screen.getByText(PAYOUT)).toBeInTheDocument();
    expect(screen.getByText('RPPs con link y comisión')).toBeInTheDocument();
    expect(screen.getByText('QR free para tus invitados')).toBeInTheDocument();
  });

  it('el lector de pantalla lee solo la frase que se ve', () => {
    render(<HeroBadge />);

    expect(screen.getByText(BRAND)).not.toHaveAttribute('aria-hidden');
    expect(screen.getByText(PAYOUT)).toHaveAttribute('aria-hidden', 'true');
  });

  it('ninguna frase lleva coma', () => {
    const { container } = render(<HeroBadge />);

    expect(container).not.toHaveTextContent(',');
  });

  it('con «reducir movimiento» queda fija en la frase de marca', () => {
    vi.useFakeTimers();
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    render(<HeroBadge />);

    act(() => vi.advanceTimersByTime(3500 * 4));

    expect(screen.getByText(BRAND)).toBeVisible();
    expect(screen.getByText(PAYOUT)).not.toBeVisible();
  });
});
