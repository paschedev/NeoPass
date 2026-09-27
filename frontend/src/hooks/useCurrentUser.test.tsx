import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import {
  saveSession,
  useCurrentUser,
  type SessionUser,
} from './useCurrentUser';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const CUSTOMER: SessionUser = {
  id: 'u1',
  email: 'ana@neopass.test',
  name: 'Ana',
  role: 'CUSTOMER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

describe('useCurrentUser', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { replace: vi.fn() },
    });
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('sin sesión guardada no hay usuario y la sesión está lista', () => {
    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.ready).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('devuelve el usuario guardado', () => {
    localStorage.setItem('user', JSON.stringify(CUSTOMER));

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user).toEqual(CUSTOMER);
  });

  it('un usuario corrupto en el almacenamiento cuenta como sin sesión', () => {
    localStorage.setItem('user', '{no es json');

    const { result } = renderHook(() => useCurrentUser());

    expect(result.current.user).toBeNull();
  });

  it('refresh trae el usuario de /auth/me y lo actualiza en toda la app', async () => {
    localStorage.setItem('user', JSON.stringify(CUSTOMER));
    const updated = { ...CUSTOMER, isCurrentlyScanner: true };
    vi.mocked(apiFetch).mockResolvedValue(Response.json(updated));
    const first = renderHook(() => useCurrentUser());
    const second = renderHook(() => useCurrentUser());

    await act(() => first.result.current.refresh());

    expect(apiFetch).toHaveBeenCalledWith('/auth/me');
    expect(first.result.current.user).toEqual(updated);
    expect(second.result.current.user).toEqual(updated);
    expect(JSON.parse(localStorage.getItem('user')!)).toEqual(updated);
  });

  it('si /auth/me falla, la sesión queda como estaba', async () => {
    localStorage.setItem('user', JSON.stringify(CUSTOMER));
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    const { result } = renderHook(() => useCurrentUser());

    await act(() => result.current.refresh());

    expect(result.current.user).toEqual(CUSTOMER);
  });

  it('logout borra la sesión y vuelve al inicio', () => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify(CUSTOMER));
    const { result } = renderHook(() => useCurrentUser());

    act(() => result.current.logout());

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(window.location.replace).toHaveBeenCalledWith('/');
  });

  it('al guardar la sesión del login, queda disponible en toda la app', () => {
    const { result } = renderHook(() => useCurrentUser());

    act(() => saveSession('jwt', CUSTOMER));

    expect(localStorage.getItem('token')).toBe('jwt');
    expect(result.current.user).toEqual(CUSTOMER);
  });
});
