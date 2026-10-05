'use client';

import { Check, Mail, X } from 'lucide-react';
import { useStaffInvitation } from '@/hooks/useStaffInvitation';
import { formatWeekdayDateTime } from '@/utils/format';
import { ownRoleLabel } from '@/utils/staff-roles';
import { commissionLabel } from '@/utils/staff-overview';
import { permissionsSummary } from '@/utils/co-organizers';
import toast from '@/utils/toast';
import type { MyStaffInvitation } from './types';

// Invitaciones sin responder de eventos que no terminaron. Se responden acá o
// desde la campanita; las dos quedan al día.
export default function StaffInvitations({
  invitations,
  onAnswered,
}: {
  invitations: MyStaffInvitation[];
  onAnswered: () => void;
}) {
  const { processingIds, respond } = useStaffInvitation();

  const answer = async (id: string, action: 'accept' | 'reject') => {
    const outcome = await respond(id, action);
    if (outcome === 'done') {
      toast.success(
        action === 'accept' ? 'Invitación aceptada' : 'Invitación rechazada',
      );
    }
    if (outcome !== 'failed') onAnswered();
  };

  return (
    <section
      aria-label="Invitaciones pendientes"
      className="bg-indigo-500/10 border border-indigo-500/20 rounded-3xl p-5 md:p-6"
    >
      <h2 className="font-outfit text-lg font-bold text-white flex items-center gap-2 mb-4">
        <Mail className="w-5 h-5 text-indigo-300" /> Invitaciones pendientes
      </h2>
      <ul className="space-y-3">
        {invitations.map((invitation) => {
          const commission = commissionLabel(
            invitation.commissionType,
            invitation.commissionValue,
          );
          const busy = processingIds.has(invitation.id);
          return (
            <li
              key={invitation.id}
              className="bg-black/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-white truncate">
                  {invitation.event.title}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatWeekdayDateTime(invitation.event.startDate)} ·{' '}
                  {ownRoleLabel(invitation.role)}
                  {commission && ` · ${commission}`}
                </p>
                <p className="text-xs text-neutral-500">
                  Organiza {invitation.event.organizerName}
                </p>
                {invitation.role === 'MANAGER' && (
                  <p className="text-xs text-neutral-300 mt-1">
                    Vas a poder:{' '}
                    {permissionsSummary(
                      invitation.permissions,
                      invitation.freeTicketLimit,
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => answer(invitation.id, 'accept')}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" /> Aceptar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => answer(invitation.id, 'reject')}
                  className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" /> Rechazar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
