'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { renderGoogleButton } from '@/utils/google-identity';
import { isInAppBrowser } from '@/utils/google-sign-in';
import LastUsedBadge from './LastUsedBadge';

type Status = 'loading' | 'ready' | 'failed';

const noSubscription = () => () => {};

// El botón oficial de Google, con su lugar reservado para que nada salte
// mientras carga. Si el script no carga (un bloqueador), queda un aviso en el
// mismo lugar y el resto del formulario sigue igual.
export default function GoogleButton({
  text = 'continue_with',
  onCredential,
  lastUsed = false,
}: {
  text?: 'continue_with' | 'signin_with' | 'signup_with';
  onCredential: (credential: string) => void;
  lastUsed?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const handler = useRef(onCredential);
  const [status, setStatus] = useState<Status>('loading');
  // Del navegador, que no cambia: en el servidor no es una app.
  const inApp = useSyncExternalStore(
    noSubscription,
    () => isInAppBrowser(navigator.userAgent),
    () => false,
  );

  useEffect(() => {
    handler.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (inApp) return;
    const parent = container.current;
    if (!parent) return;
    let release: (() => void) | null = null;
    let unmounted = false;
    renderGoogleButton(parent, {
      text,
      width: parent.offsetWidth,
      onCredential: (credential) => handler.current(credential),
    })
      .then((done) => {
        if (unmounted) done();
        else {
          release = done;
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!unmounted) setStatus('failed');
      });
    return () => {
      unmounted = true;
      release?.();
    };
  }, [text, inApp]);

  if (inApp) {
    return (
      <p className="min-h-10 flex items-center justify-center text-center text-sm text-neutral-300 bg-white/5 border border-white/10 rounded-full px-4 py-2">
        Para entrar con Google, abrí esta página en Chrome o Safari.
      </p>
    );
  }

  return (
    <div className="relative h-10">
      {status === 'loading' && (
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-white/5 border border-white/10 animate-pulse"
        />
      )}
      {status === 'failed' && (
        <p className="absolute inset-0 flex items-center justify-center text-center text-xs text-neutral-400 bg-white/5 border border-white/10 rounded-full px-4">
          No pudimos cargar Google. Ingresá con tu correo.
        </p>
      )}
      <div
        ref={container}
        className={`flex justify-center ${status === 'ready' ? '' : 'invisible'}`}
      />
      {lastUsed && status === 'ready' && <LastUsedBadge />}
    </div>
  );
}
