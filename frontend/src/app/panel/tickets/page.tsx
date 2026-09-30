'use client';

import { useEffect, useState } from 'react';
import { Ticket as TicketIcon } from 'lucide-react';
import toast from '@/utils/toast';
import TicketCard from '@/components/tickets/TicketCard';
import TicketModal from '@/components/tickets/TicketModal';
import type { MyTicket } from '@/components/tickets/types';
import type { UserSearchResult } from '@/hooks/useUserSearch';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';

export default function MisEntradasPage() {
  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<MyTicket | null>(null);
  const [transferring, setTransferring] = useState(false);

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
        Mis Tickets
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
            No tienes entradas
          </h3>
          <p className="text-neutral-400">
            Aún no has comprado entradas para ningún evento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onOpen={() => setSelectedTicket(ticket)}
            />
          ))}
        </div>
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
