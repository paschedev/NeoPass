import { getSafeRedirect } from './redirect';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
  // Last news on the notice (sales add up on the same one).
  activityAt?: string;
  isRead: boolean;
  actionUrl: string | null;
  metadata?: {
    status?: InvitationStatus;
    eventStaffId?: string;
    [key: string]: unknown;
  } | null;
};

export type NotificationFeed = {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
};

export function feedPath({
  limit,
  cursor,
  onlyRequests = false,
}: {
  limit: number;
  cursor?: string;
  onlyRequests?: boolean;
}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  if (onlyRequests) params.set('onlyRequests', 'true');
  return `/notifications/feed?${params}`;
}

// When the notice last had news, which is what the list shows.
export function noticeTime({
  createdAt,
  activityAt,
}: Pick<AppNotification, 'createdAt' | 'activityAt'>): Date {
  return new Date(activityAt ?? createdAt);
}

// The staff membership an unanswered invitation notice lets you accept or
// reject, or null.
export function pendingInvitationStaffId({
  type,
  metadata,
}: Pick<AppNotification, 'type' | 'metadata'>): string | null {
  return type === 'STAFF_INVITE' && metadata?.status === 'PENDING'
    ? (metadata.eventStaffId ?? null)
    : null;
}

// Where the notice takes you, only if it stays inside NeoPass.
export function notificationHref({
  actionUrl,
}: Pick<AppNotification, 'actionUrl'>): string | null {
  return getSafeRedirect(actionUrl);
}
