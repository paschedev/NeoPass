import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import { useUserSearch } from './useUserSearch';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const ANA = { id: 'u1', name: 'Ana', email: 'ana@neopass.test' };

describe('useUserSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('con menos de 3 letras no busca', async () => {
    const { result } = renderHook(() => useUserSearch('an'));

    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(apiFetch).not.toHaveBeenCalled();
    expect(result.current).toEqual([]);
  });

  it('busca 300 ms después de la última letra, con el texto codificado', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json([ANA]));
    const { result, rerender } = renderHook(({ term }) => useUserSearch(term), {
      initialProps: { term: 'ana' },
    });
    rerender({ term: 'ana g&x' });

    await act(() => vi.advanceTimersByTimeAsync(299));
    expect(apiFetch).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(1));

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('/auth/users/search?q=ana%20g%26x');
    expect(result.current).toEqual([ANA]);
  });

  it('ignora la respuesta de una búsqueda que ya cambió', async () => {
    let resolveFirst: (res: Response) => void = () => {};
    vi.mocked(apiFetch)
      .mockReturnValueOnce(new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(Response.json([ANA]));
    const { result, rerender } = renderHook(({ term }) => useUserSearch(term), {
      initialProps: { term: 'pedro' },
    });
    await act(() => vi.advanceTimersByTimeAsync(300));

    rerender({ term: 'ana' });
    await act(() => vi.advanceTimersByTimeAsync(300));
    await act(async () => resolveFirst(Response.json([{ id: 'viejo' }])));

    expect(result.current).toEqual([ANA]);
  });

  it('si la búsqueda falla no muestra resultados', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 429 }));
    const { result } = renderHook(() => useUserSearch('ana'));

    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(result.current).toEqual([]);
  });
});
