'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAdminList } from '@/hooks/useAdminList';
import { adminPanelUrl, canResendTicket } from '@/utils/admin-panel';
import { eventStatusBadge } from '@/utils/event-status';
import {
  formatCurrency,
  formatDayMonthTime,
  formatEventRange,
} from '@/utils/format';
import AdminListView, { ADMIN_ACTION } from './AdminListView';
import ResendTicketModal from './ResendTicketModal';
import type { AdminTicket } from './types';

const TICKET_STATUS_BADGES: Record<
  AdminTicket['status'],
  { label: string; className: string }
> = {
  VALID: { label: 'VÁLIDA', className: 'bg-emerald-500/10 text-emerald-400' },
  USED: { label: 'USADA', className: 'bg-indigo-500/10 text-indigo-300' },
  CANCELLED: { label: 'ANULADA', className: 'bg-red-500/10 text-red-400' },
  REFUNDED: { label: 'DEVUELTA', className: 'bg-amber-500/10 text-amber-400' },
};

function personText({ name, email }: { name: string | null; email: string }) {
  return name ? `${name} · ${email}` : email;
}

function originText(origin: NonNullable<AdminTicket['origin']>) {
  if (origin.type === 'FREE') {
    const until = origin.validUntil
      ? `Entra hasta el ${formatDayMonthTime(origin.validUntil)}`
      : 'Entra durante todo el evento';
    return `QR free de ${origin.sentBy} · ${until}`;
  }
  return [
    `Compra del ${formatDayMonthTime(origin.purchasedAt)}`,
    `${formatCurrency(origin.total)} en total`,
    origin.promoterName && `RPP ${origin.promoterName}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function Detail({ label, children }: { label: string; children: string }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-neutral-200 break-words min-w-0">{children}</dd>
    </>
  );
}

function AdminTicketCard({
  ticket,
  now,
  onResend,
}: {
  ticket: AdminTicket;
  now: Date;
  onResend: () => void;
}) {
  const { event, ticketType, owner, buyer, origin } = ticket;
  const badge = TICKET_STATUS_BADGES[ticket.status];
  const eventBadge = eventStatusBadge(event);

  return (
    <article
      aria-label={`Entrada ${ticket.code}`}
      className="bg-neutral-900 border border-white/5 rounded-3xl p-5 space-y-4"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span
            className={`px-2.5 py-1 text-[10px] font-semibold rounded-md ${badge.className}`}
          >
            {badge.label}
          </span>
          <span className="text-xs font-mono tracking-wider text-neutral-300">
            {ticket.code}
          </span>
          {ticket.usedAt && (
            <span className="text-xs text-neutral-400">
              Ingresó el {formatDayMonthTime(ticket.usedAt)}
            </span>
          )}
        </div>
        <h3 className="font-outfit text-lg font-bold text-white break-words">
          {event.title}
        </h3>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <span
            className={`px-2 py-0.5 text-[10px] font-semibold rounded-md uppercase ${eventBadge.className}`}
          >
            {eventBadge.label}
          </span>
          <span className="text-xs text-neutral-400">
            {formatEventRange(event.startDate, event.endDate)}
          </span>
        </div>
        <p className="text-xs text-neutral-300 mt-2">
          {[ticketType.name, ticketType.batchName].filter(Boolean).join(' · ')}
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {owner && <Detail label="Es de">{personText(owner)}</Detail>}
        {buyer && <Detail label="La compró">{personText(buyer)}</Detail>}
        {origin && <Detail label="Origen">{originText(origin)}</Detail>}
      </dl>

      <div className="flex flex-wrap gap-2">
        {owner && canResendTicket(ticket, now) && (
          <button
            type="button"
            aria-label={`Reenviar la entrada ${ticket.code}`}
            onClick={onResend}
            className={`${ADMIN_ACTION} bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300`}
          >
            Reenviar
          </button>
        )}
        <Link
          href={adminPanelUrl('eventos', event.title)}
          className={`${ADMIN_ACTION} bg-white/5 hover:bg-white/10 text-white`}
        >
          Ver el evento
        </Link>
      </div>
    </article>
  );
}

// Soporte de entradas: buscar una por el código que trae o por un correo, ver
// de quién es y de dónde salió, y reenviársela a quien la tiene.
export default function AdminTickets({
  search,
  onSearch,
}: {
  search: string;
  onSearch: (q: string) => void;
}) {
  const list = useAdminList<AdminTicket>('/admin/tickets', search);
  const [resending, setResending] = useState<AdminTicket | null>(null);
  const now = new Date();

  return (
    <section aria-labelledby="admin-tickets-title" className="space-y-6">
      <div>
        <h2 id="admin-tickets-title" className="sr-only">
          Tickets
        </h2>
        <p className="text-sm text-neutral-400">
          Buscá una entrada por su código o por el correo de quien la tiene o
          la compró.
        </p>
      </div>

      <AdminListView
        list={list}
        search={search}
        onSearch={onSearch}
        searchLabel="Buscar por código o correo"
        searchPlaceholder="Código o correo"
        texts={{
          loading: 'Cargando entradas...',
          failed: 'No pudimos cargar las entradas.',
          empty: 'Todavía no hay entradas.',
          noMatches: 'No hay entradas que coincidan con la búsqueda.',
        }}
        pagerLabel="Páginas de entradas"
        renderItem={(ticket) => (
          <AdminTicketCard
            ticket={ticket}
            now={now}
            onResend={() => setResending(ticket)}
          />
        )}
      />

      <ResendTicketModal
        ticket={resending}
        onClose={() => setResending(null)}
      />
    </section>
  );
}
