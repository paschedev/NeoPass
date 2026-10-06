import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppNotification, notificationHref } from '@/utils/notifications';

// The notice's text, which opens its page when it has a safe internal link.
export function NoticeLink({
  notice,
  onOpen,
  className = '',
  children,
}: {
  notice: Pick<AppNotification, 'actionUrl'>;
  onOpen: () => void;
  className?: string;
  children: ReactNode;
}) {
  const href = notificationHref(notice);
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} onClick={onOpen} className={`block ${className}`}>
      {children}
    </Link>
  );
}
