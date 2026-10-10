'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { useCurrentUser, type SessionUser } from '@/hooks/useCurrentUser';
import EmailCodeStep from '@/components/account/EmailCodeStep';
import ChangeEmailForm from '@/components/account/ChangeEmailForm';

type Mode =
  | { kind: 'idle' }
  | { kind: 'change' }
  // `change`: el correo nuevo y la contraseña, para volver a pedir su código.
  | {
      kind: 'code';
      sentTo: string;
      change: { newEmail: string; password: string } | null;
    };

const requestVerification = () =>
  apiFetch('/auth/email/verification', { method: 'POST' });

// "Correo" en Configuración: si está confirmado, confirmarlo con un código y
// cambiarlo por otro (con la contraseña y un código al correo nuevo).
export default function EmailSection() {
  const { user, refresh } = useCurrentUser();
  const [mode, setMode] = useState<Mode>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  if (!user) return null;

  const askVerification = async () => {
    setError(null);
    setAsking(true);
    try {
      const res = await requestVerification();
      const body: unknown = await res.json();
      if (res.ok) {
        setMode({
          kind: 'code',
          sentTo: (body as { sentTo: string }).sentTo,
          change: null,
        });
        return;
      }
      setError(getApiErrorMessage(body, 'No pudimos mandar el código'));
      // Ya estaba confirmado (por ejemplo, desde otra pestaña).
      if (res.status === 409) void refresh();
    } catch {
      setError('Error de conexión. Probá de nuevo.');
    } finally {
      setAsking(false);
    }
  };

  const confirmed = (updated: SessionUser) => {
    toast.success(
      updated.email !== user.email
        ? `Tu correo ahora es ${updated.email}`
        : '¡Listo! Confirmaste tu correo.',
    );
    setMode({ kind: 'idle' });
  };

  return (
    <section
      id="correo"
      aria-labelledby="email-section-title"
      className="bg-white/5 border border-white/10 rounded-3xl p-8 mb-8 scroll-mt-24"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 shrink-0 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
            <Mail className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2
              id="email-section-title"
              className="text-xl font-bold text-white"
            >
              Correo
            </h2>
            <p className="text-neutral-400 text-sm break-all">{user.email}</p>
            {user.emailVerified === true && (
              <span className="inline-block mt-1 text-xs font-medium text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                Confirmado
              </span>
            )}
            {user.emailVerified === false && (
              <span className="inline-block mt-1 text-xs font-medium text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                Sin confirmar
              </span>
            )}
          </div>
        </div>
        {mode.kind === 'idle' && (
          <div className="flex flex-col sm:flex-row gap-2">
            {user.emailVerified === false && (
              <button
                type="button"
                onClick={askVerification}
                disabled={asking}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                Confirmar mi correo
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode({ kind: 'change' });
              }}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-4 py-3 sm:py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Cambiar correo
            </button>
          </div>
        )}
      </div>

      {error && mode.kind === 'idle' && (
        <p role="alert" className="text-red-400 text-sm mt-4">
          {error}
        </p>
      )}

      {mode.kind === 'change' && (
        <div className="mt-6 border-t border-white/10 pt-6 max-w-md">
          <ChangeEmailForm
            onSent={(sentTo, password) =>
              setMode({
                kind: 'code',
                sentTo,
                change: { newEmail: sentTo, password },
              })
            }
            onCancel={() => setMode({ kind: 'idle' })}
          />
        </div>
      )}

      {mode.kind === 'code' && (
        <div className="mt-6 border-t border-white/10 pt-6 max-w-md">
          <EmailCodeStep
            key={mode.sentTo}
            sentTo={mode.sentTo}
            resend={() =>
              mode.change
                ? apiFetch('/auth/email/change', {
                    method: 'POST',
                    body: JSON.stringify(mode.change),
                  })
                : requestVerification()
            }
            onConfirmed={confirmed}
          >
            <button
              type="button"
              onClick={() => setMode({ kind: 'idle' })}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          </EmailCodeStep>
        </div>
      )}
    </section>
  );
}
