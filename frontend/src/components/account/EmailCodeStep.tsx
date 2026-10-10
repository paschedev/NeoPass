'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { updateSessionUser, type SessionUser } from '@/hooks/useCurrentUser';

// Lo mismo que espera el backend entre un código y otro.
const RESEND_WAIT_SECONDS = 60;

// El paso de escribir el código de 6 números que llegó por mail: confirma el
// correo de la cuenta o el nuevo. `resend` vuelve a pedirlo y `children` suma
// acciones debajo (corregir el correo, dejarlo para después).
export default function EmailCodeStep({
  sentTo,
  resend,
  onConfirmed,
  children,
}: {
  sentTo: string;
  resend: () => Promise<Response>;
  onConfirmed: (user: SessionUser) => void;
  children?: React.ReactNode;
}) {
  const inputId = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_WAIT_SECONDS);

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsLeft((seconds) => (seconds > 0 ? seconds - 1 : 0)),
      1000,
    );
    return () => clearInterval(timer);
  }, []);

  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetch('/auth/email/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      const body: unknown = await res.json();
      if (!res.ok) {
        setError(getApiErrorMessage(body, 'No pudimos confirmar el código'));
        return;
      }
      updateSessionUser(body as SessionUser);
      onConfirmed(body as SessionUser);
    } catch {
      setError('Error de conexión. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const sendAgain = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await resend();
      if (!res.ok) {
        setError(
          getApiErrorMessage(await res.json(), 'No pudimos mandar otro código'),
        );
        return;
      }
      setCode('');
      setSecondsLeft(RESEND_WAIT_SECONDS);
      toast.success('Te mandamos otro código');
    } catch {
      setError('Error de conexión. Probá de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={confirm} className="space-y-4" noValidate>
      <p className="text-sm text-neutral-300">
        Te mandamos un código de 6 números a{' '}
        <strong className="text-white break-all">{sentTo}</strong>. Revisá
        también Spam o Promociones.
      </p>

      <div>
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-neutral-400 mb-1"
        >
          Código
        </label>
        <input
          id={inputId}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
      >
        Confirmar
      </button>

      <div className="flex flex-col items-center gap-2 text-sm">
        <button
          type="button"
          onClick={sendAgain}
          disabled={busy || secondsLeft > 0}
          className="text-indigo-400 hover:text-indigo-300 disabled:text-neutral-500 transition-colors"
        >
          {secondsLeft > 0
            ? `Reenviar código en ${secondsLeft} s`
            : 'Reenviar código'}
        </button>
        {children}
      </div>
    </form>
  );
}
