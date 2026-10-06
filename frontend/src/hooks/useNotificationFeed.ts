'use client';

import { useCallback, useState } from 'react';
import { apiFetch } from '@/utils/api';
import {
  AppNotification,
  feedPath,
  InvitationStatus,
  NotificationFeed,
} from '@/utils/notifications';

// The user's notices, newest first, a page at a time, with how many are unread
// in total (not only in the loaded pages). Each screen decides when to load
// them with `reload`.
export function useNotificationFeed({
  limit,
  onlyRequests = false,
}: {
  limit: number;
  onlyRequests?: boolean;
}) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const fetchPage = useCallback(
    async (cursor?: string): Promise<NotificationFeed | null> => {
      const res = await apiFetch(feedPath({ limit, cursor, onlyRequests }));
      if (!res.ok) return null;
      return (await res.json()) as NotificationFeed;
    },
    [limit, onlyRequests],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const page = await fetchPage().catch(() => null);
    setFailed(page === null);
    setItems(page?.items ?? []);
    setNextCursor(page?.nextCursor ?? null);
    setUnreadCount(page?.unreadCount ?? 0);
    setLoading(false);
  }, [fetchPage]);

  const loadMore = async () => {
    if (!nextCursor) return;
    setLoading(true);
    const page = await fetchPage(nextCursor).catch(() => null);
    setFailed(page === null);
    if (page) {
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
      setUnreadCount(page.unreadCount);
    }
    setLoading(false);
  };

  // Changes are shown at once; if the server rejects one, the list is
  // reloaded so it shows what is really stored. Returns whether it worked.
  const sync = async (path: string, method: 'PUT' | 'DELETE') => {
    const res = await apiFetch(path, { method }).catch(() => null);
    if (!res?.ok) await reload();
    return res?.ok ?? false;
  };

  const markReadLocally = (
    id: string,
    metadata?: AppNotification['metadata'],
  ) => {
    const notice = items.find((n) => n.id === id);
    if (notice && !notice.isRead) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    setItems((current) =>
      current.map((n) =>
        n.id === id
          ? { ...n, isRead: true, ...(metadata ? { metadata } : {}) }
          : n,
      ),
    );
  };

  const markAsRead = async (id: string) => {
    const notice = items.find((n) => n.id === id);
    if (!notice || notice.isRead) return true;
    markReadLocally(id);
    return sync(`/notifications/${id}/read`, 'PUT');
  };

  const markAllAsRead = async () => {
    setItems((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    return sync('/notifications/read-all', 'PUT');
  };

  const remove = async (id: string) => {
    const notice = items.find((n) => n.id === id);
    setItems((current) => current.filter((n) => n.id !== id));
    if (notice && !notice.isRead) {
      setUnreadCount((count) => Math.max(0, count - 1));
    }
    return sync(`/notifications/${id}`, 'DELETE');
  };

  // An invitation answered from its notice: the server already marked it read.
  const markAnswered = (id: string, status: InvitationStatus) => {
    const notice = items.find((n) => n.id === id);
    markReadLocally(id, { ...notice?.metadata, status });
  };

  return {
    items,
    unreadCount,
    hasMore: nextCursor !== null,
    loading,
    failed,
    reload,
    loadMore,
    markAsRead,
    markAllAsRead,
    remove,
    markAnswered,
  };
}
