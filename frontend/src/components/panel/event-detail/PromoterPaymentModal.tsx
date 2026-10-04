'use client';

import { useId } from 'react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import type { PaymentFormOutput } from '@/utils/promoter-payment';
import toast from '@/utils/toast';
import RegisterPaymentForm from './RegisterPaymentForm';

export interface PaymentTarget {
  eventId: string;
  staffId: string;
  name: string;
  balance: number;
}

// Anota un pago a un RPP de un evento. Lo usan el detalle del evento y la
// pestaña Mi staff; el pago en sí pasa por fuera de NeoPass.
export default function PromoterPaymentModal({
  target,
  onClose,
  onPaid,
}: {
  target: PaymentTarget | null;
  onClose: () => void;
  onPaid: () => void;
}) {
  const titleId = useId();

  const registerPayment = async (payment: PaymentFormOutput) => {
    if (!target) return;
    try {
      const res = await apiFetch(
        `/events/organizer/${target.eventId}/promoters/${target.staffId}/payments`,
        { method: 'POST', body: JSON.stringify(payment) },
      );
      if (!res.ok) {
        toast.error(
          getApiErrorMessage(await res.json(), 'No se pudo registrar el pago'),
        );
        return;
      }
      toast.success('Pago registrado');
      onPaid();
    } catch {
      toast.error('Error de conexión');
    }
  };

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      labelledBy={titleId}
      className="bg-neutral-900 border border-white/10 p-6 md:p-8 rounded-3xl w-full max-w-sm shadow-2xl"
    >
      {target && (
        <RegisterPaymentForm
          promoterName={target.name}
          balance={target.balance}
          titleId={titleId}
          onSubmit={registerPayment}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
