'use client';

import { useState } from 'react';
import { MailCheck, X } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import EmailCodeStep from './EmailCodeStep';

const requestVerification = () =>
  apiFetch('/auth/email/verification', { method: 'POST' });

// Confirmar el correo sin salir de la pantalla: primero se pide el código y
// después se escribe. Si ya hay un código reciente (pedir otro hace esperar),
// se puede ir directo a escribirlo.
export default function ConfirmEmailModal({
  open,
  onClose,
  onConfirmed,
}: {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="confirm-email-title">
      {/* Se monta al abrirse: cada vez arranca desde el primer paso */}
      {open && (
        <ConfirmEmailSteps onClose={onClose} onConfirmed={onConfirmed} />
      )}
    </Modal>
  );
}

function ConfirmEmailSteps({
  onClose,
  onConfirmed,
}: {
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const { user, refresh } = useCurrentUser();
  // Adónde se mandó el código y si se acaba de mandar o se llegó con uno
  // de antes.
  const [sent, setSent] = useState<{ to: string; justSent: boolean } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  if (!user) return null;

  const askCode = async () => {
    setError(null);
    setAsking(true);
    try {
      const res = await requestVerification();
      const body: unknown = await res.json();
      if (res.ok) {
        setSent({ to: (body as { sentTo: string }).sentTo, justSent: true });
        return;
      }
      // Ya estaba confirmado (por ejemplo, desde otra pestaña).
      if (res.status === 409) {
        await refresh();
        onConfirmed();
        return;
      }
      setError(getApiErrorMessage(body, 'No pudimos mandar el código'));
    } catch {
      setError('Error de conexión. Probá de nuevo.');
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
            <MailCheck className="w-5 h-5" />
          </div>
          <h2
            id="confirm-email-title"
            className="font-outfit text-xl font-bold text-white"
          >
            Confirmá tu correo
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-8 h-8 shrink-0 bg-white/5 rounded-full flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {sent === null ? (
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">
            Te vamos a mandar un código de 6 números a{' '}
            <strong className="text-white [overflow-wrap:anywhere]">
              {user.email}
            </strong>
            . Cuando lo escribas, tus entradas de regalo se desbloquean.
          </p>
          {error && (
            <p role="alert" className="text-red-400 text-sm">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={askCode}
            disabled={asking}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Mandarme el código
          </button>
          <button
            type="button"
            onClick={() => setSent({ to: user.email, justSent: false })}
            className="w-full text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Ya tengo un código
          </button>
        </div>
      ) : (
        <EmailCodeStep
          sentTo={sent.to}
          justSent={sent.justSent}
          resend={requestVerification}
          onConfirmed={onConfirmed}
        />
      )}
    </div>
  );
}
