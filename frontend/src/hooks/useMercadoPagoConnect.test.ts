import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { useMercadoPagoConnect } from './useMercadoPagoConnect';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({ default: { error: vi.fn() } }));

const AUTH_URL = 'https://auth.mercadopago.com.ar/authorization?client_id=1';

describe('useMercadoPagoConnect', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, assign: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it('pide el link de Mercado Pago y lleva al usuario a autorizar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ url: AUTH_URL }));
    const { result } = renderHook(() => useMercadoPagoConnect());

    await act(() => result.current.connect());

    expect(apiFetch).toHaveBeenCalledWith('/payments/oauth/link');
    expect(window.location.assign).toHaveBeenCalledWith(AUTH_URL);
    // Sigue "conectando" mientras el navegador se va a Mercado Pago.
    expect(result.current.connecting).toBe(true);
  });

  it('mientras conecta no pide el link dos veces', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({ url: AUTH_URL }));
    const { result } = renderHook(() => useMercadoPagoConnect());

    await act(async () => {
      await Promise.all([result.current.connect(), result.current.connect()]);
    });

    expect(apiFetch).toHaveBeenCalledTimes(1);
  });

  it('si el backend no da el link, avisa y deja reintentar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json({ message: 'Solo organizadores' }, { status: 403 }),
    );
    const { result } = renderHook(() => useMercadoPagoConnect());

    await act(() => result.current.connect());

    expect(toast.error).toHaveBeenCalledWith('Solo organizadores');
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(result.current.connecting).toBe(false);
  });

  it('sin conexión, avisa y deja reintentar', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useMercadoPagoConnect());

    await act(() => result.current.connect());

    expect(toast.error).toHaveBeenCalledWith('Error de conexión al servidor');
    expect(result.current.connecting).toBe(false);
  });
});
