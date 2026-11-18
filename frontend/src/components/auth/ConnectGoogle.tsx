'use client';

import { useState } from 'react';
import { updateSessionUser, type SessionUser } from '@/hooks/useCurrentUser';
import { apiFetch } from '@/utils/api';
import { getApiErrorMessage } from '@/utils/api-error';
import { rememberLoginMethod } from '@/utils/google-sign-in';
import GoogleButton from './GoogleButton';

// Conecta la cuenta de Google del mismo correo a la sesión abierta.
export default function ConnectGoogle({
  onConnected,
}: {
  onConnected: (user: SessionUser) => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const connect = async (credential: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch('/auth/google/connect', {
        method: 'POST',
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          res.status === 401
            ? 'Tu sesión expiró. Ingresá de nuevo.'
            : getApiErrorMessage(data, 'No pudimos conectar Google'),
        );
        return;
      }
      updateSessionUser(data as SessionUser);
      rememberLoginMethod('google');
      onConnected(data as SessionUser);
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <GoogleButton onCredential={connect} />
      {error && (
        <p role="alert" className="text-sm text-red-400 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
