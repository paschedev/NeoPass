'use client';

import { useRef, useState } from 'react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser } from './useCurrentUser';

export type InvitationOutcome = 'done' | 'already-processed' | 'failed';

// Aceptar o rechazar una invitación de staff (RPP, scanner o encargado), desde
// una notificación (que queda leída) o desde la página Staff. Cada pantalla
// actualiza su lista según el resultado.
export function useStaffInvitation() {
  const { refresh } = useCurrentUser();
  const pending = useRef(new Set<string>());
  const [processingIds, setProcessingIds] = useState<ReadonlySet<string>>(
    new Set(),
  );

  const track = (eventStaffId: string, active: boolean) => {
    if (active) pending.current.add(eventStaffId);
    else pending.current.delete(eventStaffId);
    setProcessingIds(new Set(pending.current));
  };

  const respond = async (
    eventStaffId: string,
    action: 'accept' | 'reject',
    notificationId?: string,
  ): Promise<InvitationOutcome> => {
    if (pending.current.has(eventStaffId)) return 'failed';
    track(eventStaffId, true);
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
        // 409: ya estaba aceptada o rechazada
        return res.status === 409 ? 'already-processed' : 'failed';
      }
      // Aceptar suma el rol de RPP o scanner: la navegación lo muestra al instante
      if (action === 'accept') await refresh();
      if (notificationId) {
        await apiFetch(`/notifications/${notificationId}/read`, {
          method: 'PUT',
        });
      }
      return 'done';
    } catch {
      toast.error('Error de conexión');
      return 'failed';
    } finally {
      track(eventStaffId, false);
    }
  };

  return { processingIds, respond };
}
