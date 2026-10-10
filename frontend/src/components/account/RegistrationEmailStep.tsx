'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getHomePath } from '@/utils/navigation';
import type { SessionUser } from '@/hooks/useCurrentUser';
import EmailCodeStep from './EmailCodeStep';
import ChangeEmailForm from './ChangeEmailForm';

// Después de crear la cuenta (con la sesión ya iniciada): el código que llegó
// al correo. Si el correo estaba mal escrito, se corrige acá mismo y el código
// va al nuevo; confirmar puede quedar para después.
export default function RegistrationEmailStep({ user }: { user: SessionUser }) {
  const router = useRouter();
  const [correcting, setCorrecting] = useState(false);
  // El correo nuevo y la contraseña, para volver a pedir su código.
  const [correction, setCorrection] = useState<{
    newEmail: string;
    password: string;
  } | null>(null);

  const sentTo = correction?.newEmail ?? user.email;
  const resend = () =>
    correction
      ? apiFetch('/auth/email/change', {
          method: 'POST',
          body: JSON.stringify(correction),
        })
      : apiFetch('/auth/email/verification', { method: 'POST' });

  const confirmed = (updated: SessionUser) => {
    toast.success('¡Listo! Confirmaste tu correo.');
    router.replace(getHomePath(updated));
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-outfit text-2xl font-bold text-white mb-1">
          Confirmá tu correo
        </h1>
        <p className="text-neutral-400 text-sm">
          Así te aseguramos que tus entradas y los avisos de la cuenta lleguen
          bien.
        </p>
      </div>

      {correcting ? (
        <ChangeEmailForm
          onSent={(newEmail, password) => {
            setCorrection({ newEmail, password });
            setCorrecting(false);
          }}
          onCancel={() => setCorrecting(false)}
        />
      ) : (
        <EmailCodeStep
          key={sentTo}
          sentTo={sentTo}
          resend={resend}
          onConfirmed={confirmed}
        >
          <button
            type="button"
            onClick={() => setCorrecting(true)}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            ¿Está mal tu correo? Corregilo
          </button>
          <button
            type="button"
            onClick={() => router.replace(getHomePath(user))}
            className="text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
          >
            Lo hago después
          </button>
        </EmailCodeStep>
      )}
    </div>
  );
}
