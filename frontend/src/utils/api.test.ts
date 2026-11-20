import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api';

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch() {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    return () => (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
  }

  it('una carga que tarda más de 15 segundos se corta para poder reintentar', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const sent = stubFetch();

    await apiFetch('/events');

    expect(timeout).toHaveBeenCalledWith(15_000);
    expect(sent().signal).toBeInstanceOf(AbortSignal);
  });

  it('una compra o un escaneo no se cortan: no sabríamos si se hicieron', async () => {
    const sent = stubFetch();

    await apiFetch('/orders/checkout', { method: 'POST', body: '{}' });

    expect(sent().signal).toBeUndefined();
  });

  it('respeta la señal propia de quien llama', async () => {
    const sent = stubFetch();
    const controller = new AbortController();

    await apiFetch('/events', { signal: controller.signal });

    expect(sent().signal).toBe(controller.signal);
  });
});
