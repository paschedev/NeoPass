'use client';

import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Lock,
  MailCheck,
  Ticket as TicketIcon,
} from 'lucide-react';
import toast from '@/utils/toast';
import TicketCard from '@/components/tickets/TicketCard';
import TicketModal from '@/components/tickets/TicketModal';
import LockedTicketCard from '@/components/tickets/LockedTicketCard';
import ConfirmEmailModal from '@/components/account/ConfirmEmailModal';
import type { MyTicket } from '@/components/tickets/types';
import type { UserSearchResult } from '@/hooks/useUserSearch';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { lockedTicketsTitle, splitTickets } from '@/utils/my-tickets';

function TicketGrid({
  tickets,
  locked = 0,
  onOpen,
  onUnlock,
}: {
  tickets: MyTicket[];
  locked?: number;
  onOpen: (ticket: MyTicket) => void;
  onUnlock?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {onUnlock &&
        Array.from({ length: locked }, (_, index) => (
          <LockedTicketCard key={`locked-${index}`} onOpen={onUnlock} />
        ))}
      {tickets.map((ticket) => (
        <TicketCard
          key={ticket.id}
          ticket={ticket}
          onOpen={() => onOpen(ticket)}
        />
      ))}
    </div>
  );
}

// Mientras el correo no está confirmado: cuántas entradas de regalo esperan
// y el acceso directo para confirmarlo.
function ConfirmEmailNotice({
  locked,
  onConfirm,
}: {
  locked: number;
  onConfirm: () => void;
}) {
  const Icon = locked > 0 ? Lock : MailCheck;
  return (
    <div
      role="status"
      className="mb-8 flex flex-col sm:flex-row sm:items-center gap-4 rounded-3xl border border-amber-500/20 bg-amber-500/10 p-5"
    >
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-5 h-5 shrink-0 text-amber-400" />
          <h2 className="font-semibold text-amber-100">
            {lockedTicketsTitle(locked)}
          </h2>
        </div>
        <p className="text-sm text-amber-100/80">
          {locked > 0
            ? 'Te las regalaron a tu correo. Confirmalo con un código y vas a poder usarlas.'
            : 'Si te regalan entradas a tu correo, las vas a ver acá cuando lo confirmes.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onConfirm}
        className="self-start sm:self-auto shrink-0 rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/30 transition-colors"
      >
        Confirmar mi correo
      </button>
    </div>
  );
}

async function fetchLockedCount() {
  const res = await apiFetch('/tickets/my-tickets/locked');
  if (!res.ok) return 0;
  const { count } = (await res.json()) as { count: number };
  return count;
}

export default function MisEntradasPage() {
  const { user } = useCurrentUser();
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [locked, setLocked] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<MyTicket | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);

  const fetchTickets = async () => {
    try {
      const [res, lockedCount] = await Promise.all([
        apiFetch('/tickets/my-tickets'),
        fetchLockedCount(),
      ]);
      if (res.ok) setTickets(await res.json());
      setLocked(lockedCount);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleTransfer = async (ticket: MyTicket, user: UserSearchResult) => {
    setTransferring(true);
    try {
      const res = await apiFetch(`/tickets/${ticket.id}/transfer`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId: user.id }),
      });
      if (res.ok) {
        toast.success('Entrada transferida con éxito');
        setSelectedTicket(null);
        fetchTickets();
      } else {
        toast.error(
          getApiErrorMessage(
            await res.json().catch(() => null),
            'Error al transferir',
          ),
        );
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setTransferring(false);
    }
  };

  const emailConfirmed = () => {
    setConfirmingEmail(false);
    toast.success(
      locked > 0
        ? '¡Listo! Tus entradas de regalo ya están desbloqueadas.'
        : '¡Listo! Confirmaste tu correo.',
    );
    fetchTickets();
  };

  const { current, history } = splitTickets(tickets, new Date());
  const unlock = () => setConfirmingEmail(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-400">
        Cargando tus entradas...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pb-24 pt-8 md:py-12 md:pt-24">
      <h1 className="font-outfit text-4xl font-bold text-white mb-2">
        Mis entradas
      </h1>
      <p className="text-neutral-400 mb-10">
        Tus accesos a los mejores eventos.
      </p>

      {(user?.emailVerified === false || locked > 0) && (
        <ConfirmEmailNotice locked={locked} onConfirm={unlock} />
      )}

      {tickets.length === 0 && locked === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center">
          <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <TicketIcon className="w-10 h-10 text-indigo-400" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">
            No tenés entradas
          </h3>
          <p className="text-neutral-400">
            Todavía no compraste entradas para ningún evento.
          </p>
        </div>
      ) : (
        <>
          {current.length === 0 && locked === 0 ? (
            <p className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-neutral-400">
              No tenés entradas para próximos eventos.
            </p>
          ) : (
            <TicketGrid
              tickets={current}
              locked={locked}
              onOpen={setSelectedTicket}
              onUnlock={unlock}
            />
          )}

          {history.length > 0 && (
            <section className="mt-12">
              <button
                type="button"
                onClick={() => setShowHistory((open) => !open)}
                aria-expanded={showHistory}
                className="w-full flex items-center justify-between gap-3 py-3 border-b border-white/10 text-left text-neutral-300 hover:text-white transition-colors"
              >
                <span className="font-outfit text-lg font-semibold">
                  Historial ({history.length})
                </span>
                <ChevronDown
                  className={`w-5 h-5 transition-transform ${showHistory ? 'rotate-180' : ''}`}
                />
              </button>
              {showHistory && (
                <div className="mt-6 opacity-80">
                  <TicketGrid tickets={history} onOpen={setSelectedTicket} />
                </div>
              )}
            </section>
          )}
        </>
      )}

      <TicketModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onTransfer={handleTransfer}
        transferring={transferring}
      />
      <ConfirmEmailModal
        open={confirmingEmail}
        onClose={() => setConfirmingEmail(false)}
        onConfirmed={emailConfirmed}
      />
    </div>
  );
}
