import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import type { AppNotification } from '@/utils/notifications';
import { useNotificationFeed } from './useNotificationFeed';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

function notice(id: string, isRead = false): AppNotification {
  return {
    id,
    type: 'SYSTEM',
    title: `Aviso ${id}`,
    message: 'Texto',
    createdAt: '2026-10-06T12:00:00.000Z',
    isRead,
    actionUrl: null,
  };
}

const page = (
  items: AppNotification[],
  nextCursor: string | null,
  unreadCount: number,
) => Response.json({ items, nextCursor, unreadCount });

async function loaded(
  options: { limit: number; onlyRequests?: boolean } = { limit: 2 },
) {
  const hook = renderHook(() => useNotificationFeed(options));
  await act(() => hook.result.current.reload());
  return hook;
}

describe('useNotificationFeed', () => {
  afterEach(() => vi.clearAllMocks());

  it('trae la primera página y cuántos avisos hay sin leer', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      page([notice('a'), notice('b')], 'b', 5),
    );

    const { result } = await loaded();

    expect(apiFetch).toHaveBeenCalledWith('/notifications/feed?limit=2');
    expect(result.current.items.map((n) => n.id)).toEqual(['a', 'b']);
    expect(result.current.unreadCount).toBe(5);
    expect(result.current.hasMore).toBe(true);
  });

  it('cargar más suma la página siguiente desde el último aviso', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page([notice('a'), notice('b')], 'b', 3))
      .mockResolvedValueOnce(page([notice('c')], null, 3));
    const { result } = await loaded();

    await act(() => result.current.loadMore());

    expect(apiFetch).toHaveBeenLastCalledWith(
      '/notifications/feed?limit=2&cursor=b',
    );
    expect(result.current.items.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(result.current.hasMore).toBe(false);
  });

  it('pide solo las solicitudes si se filtra', async () => {
    vi.mocked(apiFetch).mockResolvedValue(page([], null, 0));

    await loaded({ limit: 2, onlyRequests: true });

    expect(apiFetch).toHaveBeenCalledWith(
      '/notifications/feed?limit=2&onlyRequests=true',
    );
  });

  it('marcar un aviso como leído lo descuenta de los nuevos', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page([notice('a'), notice('b')], null, 2))
      .mockResolvedValueOnce(Response.json({ count: 1 }));
    const { result } = await loaded();

    await act(() => result.current.markAsRead('a'));

    expect(apiFetch).toHaveBeenLastCalledWith('/notifications/a/read', {
      method: 'PUT',
    });
    expect(result.current.items[0].isRead).toBe(true);
    expect(result.current.unreadCount).toBe(1);
  });

  it('marcar como leído uno que ya estaba leído no llama al servidor', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      page([notice('a', true)], null, 0),
    );
    const { result } = await loaded();

    await act(() => result.current.markAsRead('a'));

    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(result.current.unreadCount).toBe(0);
  });

  it('marcar todos como leídos deja el contador en cero', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page([notice('a'), notice('b')], 'b', 7))
      .mockResolvedValueOnce(Response.json({ count: 7 }));
    const { result } = await loaded();

    await act(() => result.current.markAllAsRead());

    expect(apiFetch).toHaveBeenLastCalledWith('/notifications/read-all', {
      method: 'PUT',
    });
    expect(result.current.items.every((n) => n.isRead)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('eliminar un aviso sin leer lo saca y lo descuenta', async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(page([notice('a'), notice('b')], null, 2))
      .mockResolvedValueOnce(Response.json({ count: 1 }));
    const { result } = await loaded();

    await act(() => result.current.remove('a'));

    expect(apiFetch).toHaveBeenLastCalledWith('/notifications/a', {
      method: 'DELETE',
    });
    expect(result.current.items.map((n) => n.id)).toEqual(['b']);
    expect(result.current.unreadCount).toBe(1);
  });

  it('una invitación respondida queda leída, con su respuesta, y se descuenta', async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      page(
        [
          {
            ...notice('a'),
            metadata: { status: 'PENDING', eventStaffId: 's1' },
          },
        ],
        null,
        1,
      ),
    );
    const { result } = await loaded();

    act(() => result.current.markAnswered('a', 'ACCEPTED'));

    expect(result.current.items[0]).toMatchObject({
      isRead: true,
      metadata: { status: 'ACCEPTED', eventStaffId: 's1' },
    });
    expect(result.current.unreadCount).toBe(0);
  });

  it('si el servidor falla, lo informa y la lista queda vacía', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));

    const { result } = await loaded();

    expect(result.current.failed).toBe(true);
    expect(result.current.items).toEqual([]);
  });
});
