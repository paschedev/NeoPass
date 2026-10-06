import {
  Bell,
  CalendarClock,
  DollarSign,
  Lock,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

const STYLES: Record<string, { Icon: LucideIcon; className: string }> = {
  STAFF_INVITE: { Icon: Lock, className: 'bg-purple-500/20 text-purple-400' },
  PROMOTER_SALE: {
    Icon: DollarSign,
    className: 'bg-emerald-500/20 text-emerald-400',
  },
  EVENT_SALES: {
    Icon: TrendingUp,
    className: 'bg-emerald-500/20 text-emerald-400',
  },
  TICKET_PURCHASE: {
    Icon: Ticket,
    className: 'bg-indigo-500/20 text-indigo-400',
  },
  EVENT_UPDATE: {
    Icon: CalendarClock,
    className: 'bg-amber-500/20 text-amber-400',
  },
};

const DEFAULT_STYLE = { Icon: Bell, className: 'bg-blue-500/20 text-blue-400' };

// The round icon that says at a glance what kind of notice it is.
export function NoticeIcon({ type }: { type: string }) {
  const { Icon, className } = STYLES[type] ?? DEFAULT_STYLE;
  return (
    <div
      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${className}`}
    >
      <Icon className="w-5 h-5" />
    </div>
  );
}
