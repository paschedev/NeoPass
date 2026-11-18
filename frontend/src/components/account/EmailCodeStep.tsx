'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import toast from '@/utils/toast';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { updateSessionUser, type SessionUser } from '@/hooks/useCurrentUser';

// Lo mismo que espera el backend entre un código y otro.
const RESEND_WAIT_SECONDS = 60;
const CODE_LENGTH = 6;

// Texto alineado a la izquierda con un margen que centra las 6 cifras: el
// cursor arranca delante del primer cero y cada número cae en el lugar de un
// cero sin correrse. 3ch + 1.25em es la mitad de 6 cifras con 5 espacios de
// 0.5em entre ellas; el 1px es el borde. El campo y los ceros de fondo lo
// comparten para quedar alineados.
const CODE_TEXT =
  'py-3 pr-4 pl-[calc(50%_-_1px_-_3ch_-_1.25em)] text-2xl tracking-[0.5em] tabular-nums';

// El paso de escribir el código de 6 números que llegó por mail: confirma el
// correo de la cuenta o el nuevo. `resend` vuelve a pedirlo y `children` suma
// acciones debajo (corregir el correo, dejarlo para después). Sin `justSent`
// (se llegó con un código de antes) se puede pedir otro enseguida: si es
// muy pronto, lo avisa el backend.
export default function EmailCodeStep({
  sentTo,
  resend,
  onConfirmed,
  justSent = true,
  children,
}: {
  sentTo: string;
  resend: () => Promise<Response>;
  onConfirmed: (user: SessionUser) => void;
  justSent?: boolean;
  children?: React.ReactNode;
}) {
  const inputId = useId();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    justSent ? RESEND_WAIT_SECONDS : 0,
  );

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
        <strong className="text-white [overflow-wrap:anywhere]">
          {sentTo}
        </strong>
        . Revisá también Spam o Promociones.
      </p>

      <div>
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-neutral-400 mb-1"
        >
          Código
        </label>
        <div className="relative">
          {/* Los ceros que faltan, a la derecha de lo escrito. */}
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 overflow-hidden whitespace-pre border border-transparent text-white/50 ${CODE_TEXT}`}
          >
            <span className="invisible">{code}</span>
            {'0'.repeat(CODE_LENGTH - code.length)}
          </span>
          <input
            id={inputId}
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH),
              )
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`relative w-full bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500 transition-colors ${CODE_TEXT}`}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-sm">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || code.length !== CODE_LENGTH}
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
