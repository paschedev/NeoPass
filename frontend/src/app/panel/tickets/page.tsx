'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Ticket as TicketIcon } from 'lucide-react';
import toast from '@/utils/toast';
import TicketCard from '@/components/tickets/TicketCard';
import TicketModal from '@/components/tickets/TicketModal';
import type { MyTicket } from '@/components/tickets/types';
import type { UserSearchResult } from '@/hooks/useUserSearch';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { splitTickets } from '@/utils/my-tickets';

function TicketGrid({
  tickets,
  onOpen,
}: {
  tickets: MyTicket[];
  onOpen: (ticket: MyTicket) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

export default function MisEntradasPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<MyTicket | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await apiFetch('/tickets/my-tickets');
      if (res.ok) setTickets(await res.json());
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

  const { current, history } = splitTickets(tickets, new Date());

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

      {tickets.length === 0 ? (
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
          {current.length === 0 ? (
            <p className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center text-neutral-400">
              No tenés entradas para próximos eventos.
            </p>
          ) : (
            <TicketGrid tickets={current} onOpen={setSelectedTicket} />
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
    </div>
  );
}
