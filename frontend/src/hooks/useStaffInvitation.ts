'use client';

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser } from './useCurrentUser';

export type InvitationOutcome = 'done' | 'already-processed' | 'failed';

// Aceptar o rechazar una invitación de staff (RPP o scanner) desde una
// notificación. Cada pantalla actualiza su lista según el resultado.
export function useStaffInvitation() {
  const { refresh } = useCurrentUser();
  const pending = useRef(new Set<string>());
  const [processingIds, setProcessingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const track = (notificationId: string, active: boolean) => {
    if (active) pending.current.add(notificationId);
    else pending.current.delete(notificationId);
    setProcessingIds(new Set(pending.current));
  };

  const respond = async (
    notificationId: string,
    eventStaffId: string,
    action: 'accept' | 'reject',
  ): Promise<InvitationOutcome> => {
    if (pending.current.has(notificationId)) return 'failed';
    track(notificationId, true);
    try {
      const res = await apiFetch(`/events/staff/${eventStaffId}/${action}`, {
        method: 'PUT',
      });
      if (!res.ok) {
        const message = getApiErrorMessage(
          await res.json().catch(() => null),
          'Hubo un error procesando la invitación',
        );
        toast.error(message);
        return res.status === 400 && message.includes('procesada')
          ? 'already-processed'
          : 'failed';
      }
      // Aceptar suma el rol de RPP o scanner: la navegación lo muestra al instante
      if (action === 'accept') await refresh();
      await apiFetch(`/notifications/${notificationId}/read`, {
        method: 'PUT',
      });
      return 'done';
    } catch {
      toast.error('Error de conexión');
      return 'failed';
    } finally {
      track(notificationId, false);
    }
  };

  return { processingIds, respond };
}
