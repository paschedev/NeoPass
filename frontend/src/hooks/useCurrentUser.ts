'use client';

import { useSyncExternalStore } from 'react';
import { apiFetch } from '@/utils/api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'ORGANIZER' | 'CUSTOMER';
  hasLinkedMp: boolean;
  hasBeenRpp: boolean;
  isCurrentlyScanner: boolean;
}

// La sesión vive en localStorage ('token' y 'user') y solo se escribe desde
// este módulo, que avisa con este evento a todos los componentes.
const USER_UPDATED = 'userUpdated';

let cache: { raw: string | null; user: SessionUser | null } | undefined;

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    // Un valor corrupto cuenta como sesión cerrada.
    return null;
  }
}

// Parsea una sola vez por cambio y devuelve siempre el mismo objeto mientras
// el valor guardado no cambie.
function getSnapshot(): SessionUser | null {
  const raw = localStorage.getItem('user');
  if (!cache || cache.raw !== raw) cache = { raw, user: parseUser(raw) };
  return cache.user;
}

// En el servidor y durante la hidratación todavía no se conoce la sesión.
function getServerSnapshot(): undefined {
  return undefined;
}

function subscribe(onChange: () => void) {
  window.addEventListener(USER_UPDATED, onChange);
  return () => window.removeEventListener(USER_UPDATED, onChange);
}

function saveUser(user: SessionUser): void {
  localStorage.setItem('user', JSON.stringify(user));
  window.dispatchEvent(new Event(USER_UPDATED));
}

// Guarda la sesión que devuelve el login.
export function saveSession(token: string, user: SessionUser): void {
  localStorage.setItem('token', token);
  saveUser(user);
}

// Trae los datos del usuario de nuevo (por ejemplo, después de aceptar una
// invitación o vincular Mercado Pago). Si falla, queda la sesión guardada.
async function refresh(): Promise<void> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) return;
  saveUser(await res.json());
}

function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.replace('/');
}

export function useCurrentUser() {
  const user = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    user: user ?? null,
    /** false hasta poder leer la sesión en el navegador. */
    ready: user !== undefined,
    refresh,
    logout,
  };
}
