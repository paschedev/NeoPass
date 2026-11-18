'use client';

import { useState } from 'react';
import Link from 'next/link';
import Modal from '@/components/ui/Modal';
import PasswordInput from '@/components/forms/PasswordInput';
import LegalConsentText from '@/components/legal/LegalConsentText';
import { saveSession, type SessionUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import {
  afterSignInPath,
  googleSignInStep,
  rememberLoginMethod,
  type GoogleSignInStep,
} from '@/utils/google-sign-in';
import { acceptedLegalVersions } from '@/utils/legal';
import GoogleButton from './GoogleButton';

type Session = { access_token: string; user: SessionUser };

// Lo que falta después de elegir la cuenta de Google: aceptar los términos
// (cuenta nueva), la contraseña de la cuenta que ya existe, o crear una
// contraseña opcional después de crear la cuenta.
type Pending =
  | (GoogleSignInStep & { credential: string })
  | { kind: 'new-password'; credential: string; session: Session };

const INPUT =
  'w-full bg-white/5 border border-white/10 rounded-xl pl-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors';
const PRIMARY =
  'w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50';

async function post(url: string, body: object) {
  const res = await apiFetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { ok: res.ok, data: (await res.json()) as unknown };
}

// "Continuar con Google" en Ingresar y en Registro: hace lo mismo en los dos.
export default function GoogleSignIn({
  lastUsed = false,
  onError,
}: {
  lastUsed?: boolean;
  // El error va donde la pantalla muestra los suyos.
  onError: (message: string) => void;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const open = (next: Pending | null) => {
    setPending(next);
    setStepError('');
    setAccepted(false);
    setPassword('');
    setConfirmation('');
  };

  const enter = (session: Session) => {
    saveSession(session.access_token, session.user);
    rememberLoginMethod('google');
    window.location.replace(
      afterSignInPath(window.location.search, session.user),
    );
  };

  // Cada paso manda lo suyo; un error se muestra donde está la persona.
  const send = async (
    url: string,
    body: object,
    fallback: string,
    onDone: (data: unknown) => void,
  ) => {
    setBusy(true);
    setStepError('');
    onError('');
    try {
      const { ok, data } = await post(url, body);
      if (ok) {
        onDone(data);
        return;
      }
      const step = googleSignInStep(data);
      if (step && url === '/auth/google' && !pending) {
        open({
          ...step,
          credential: (body as { credential: string }).credential,
        });
        return;
      }
      const message = getApiErrorMessage(data, fallback);
      if (pending) setStepError(message);
      else onError(message);
    } catch {
      const message = 'Error de conexión con el servidor';
      if (pending) setStepError(message);
      else onError(message);
    } finally {
      setBusy(false);
    }
  };

  const signIn = (credential: string) =>
    send(
      '/auth/google',
      { credential },
      'No pudimos entrar con Google',
      (data) => enter(data as Session),
    );

  const createAccount = (credential: string) =>
    send(
      '/auth/google',
      { credential, ...acceptedLegalVersions(false) },
      'No pudimos crear tu cuenta',
      (data) => {
        const session = data as Session;
        saveSession(session.access_token, session.user);
        rememberLoginMethod('google');
        open({ kind: 'new-password', credential, session });
      },
    );

  const link = (credential: string) =>
    send(
      '/auth/google/link',
      { credential, password },
      'No pudimos conectar Google',
      (data) => enter(data as Session),
    );

  const createPassword = (credential: string, session: Session) => {
    if (password.length < 8 || password.length > 32) {
      setStepError('La contraseña tiene que tener entre 8 y 32 caracteres');
      return;
    }
    if (password !== confirmation) {
      setStepError('Las contraseñas no coinciden');
      return;
    }
    return send(
      '/auth/google/password',
      { credential, password },
      'No pudimos crear la contraseña',
      (user) => enter({ ...session, user: user as SessionUser }),
    );
  };

  // Cerrar la cuenta recién creada no la borra: entra igual.
  const close = () => {
    if (pending?.kind === 'new-password') enter(pending.session);
    else open(null);
  };

  return (
    <>
      <GoogleButton onCredential={signIn} lastUsed={lastUsed} />

      <Modal open={pending !== null} onClose={close} labelledBy="google-step">
        <div className="p-6 sm:p-8 space-y-5">
          {pending?.kind === 'terms' && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void createAccount(pending.credential);
              }}
            >
              <div>
                <h2
                  id="google-step"
                  className="font-outfit text-2xl font-bold text-white"
                >
                  Creá tu cuenta
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Vas a entrar a NeoPass con {pending.email}.
                </p>
              </div>
              <label className="flex items-start gap-3 border border-white/10 bg-white/5 p-4 rounded-xl text-sm text-white cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-0.5 w-5 h-5 shrink-0 accent-indigo-500 rounded cursor-pointer"
                />
                <span>
                  <LegalConsentText isOrganizer={false} />
                </span>
              </label>
              {stepError && (
                <p role="alert" className="text-sm text-red-400">
                  {stepError}
                </p>
              )}
              <button
                type="submit"
                disabled={!accepted || busy}
                className={PRIMARY}
              >
                {busy ? 'Creando tu cuenta...' : 'Crear cuenta'}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </form>
          )}

          {pending?.kind === 'password' && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void link(pending.credential);
              }}
            >
              <div>
                <h2
                  id="google-step"
                  className="font-outfit text-2xl font-bold text-white"
                >
                  Conectá tu cuenta de Google
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Ya tenés una cuenta con {pending.email}. Ingresá tu contraseña
                  una vez y después entrás solo con Google.
                </p>
              </div>
              <div>
                <label
                  htmlFor="google-link-password"
                  className="block text-sm font-medium text-neutral-400 mb-1"
                >
                  Contraseña
                </label>
                <PasswordInput
                  id="google-link-password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={INPUT}
                  placeholder="••••••••"
                />
                <div className="flex justify-end mt-2">
                  <Link
                    href="/password-recovery"
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </div>
              {stepError && (
                <p role="alert" className="text-sm text-red-400">
                  {stepError}
                </p>
              )}
              <button
                type="submit"
                disabled={!password || busy}
                className={PRIMARY}
              >
                {busy ? 'Conectando...' : 'Conectar y entrar'}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full text-sm text-neutral-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
            </form>
          )}

          {pending?.kind === 'new-password' && (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void createPassword(pending.credential, pending.session);
              }}
            >
              <div>
                <h2
                  id="google-step"
                  className="font-outfit text-2xl font-bold text-white"
                >
                  Ya tenés tu cuenta
                </h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Si querés, creá una contraseña para entrar también con tu
                  correo.
                </p>
              </div>
              <div className="space-y-3">
                <PasswordInput
                  aria-label="Contraseña nueva"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className={INPUT}
                  placeholder="Contraseña nueva"
                />
                <PasswordInput
                  aria-label="Repetí la contraseña"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className={INPUT}
                  placeholder="Repetí la contraseña"
                />
              </div>
              {stepError && (
                <p role="alert" className="text-sm text-red-400">
                  {stepError}
                </p>
              )}
              <button
                type="submit"
                disabled={!password || busy}
                className={PRIMARY}
              >
                {busy ? 'Guardando...' : 'Crear contraseña'}
              </button>
              <button
                type="button"
                onClick={close}
                className="w-full text-sm text-neutral-400 hover:text-white underline underline-offset-2 transition-colors"
              >
                Omitir por ahora
              </button>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}
