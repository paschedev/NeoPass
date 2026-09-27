import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import toast from 'react-hot-toast';
import { apiFetch } from '@/utils/api';
import { useStaffInvitation } from './useStaffInvitation';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const calledUrls = () => vi.mocked(apiFetch).mock.calls.map(([url]) => url);

describe('useStaffInvitation', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('aceptar confirma, actualiza la sesión y marca la notificación como leída', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({}));
    const { result } = renderHook(() => useStaffInvitation());

    let outcome;
    await act(async () => {
      outcome = await result.current.respond('n1', 'staff-1', 'accept');
    });

    expect(outcome).toBe('done');
    expect(calledUrls()).toEqual([
      '/events/staff/staff-1/accept',
      '/auth/me',
      '/notifications/n1/read',
    ]);
  });

  it('rechazar no cambia la sesión', async () => {
    vi.mocked(apiFetch).mockResolvedValue(Response.json({}));
    const { result } = renderHook(() => useStaffInvitation());

    await act(() => result.current.respond('n1', 'staff-1', 'reject'));

    expect(calledUrls()).toEqual([
      '/events/staff/staff-1/reject',
      '/notifications/n1/read',
    ]);
  });

  it('si ya estaba respondida lo avisa para sacarla de la lista', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      Response.json(
        { message: 'La invitación ya fue procesada' },
        { status: 400 },
      ),
    );
    const { result } = renderHook(() => useStaffInvitation());

    let outcome;
    await act(async () => {
      outcome = await result.current.respond('n1', 'staff-1', 'accept');
    });

    expect(outcome).toBe('already-processed');
    expect(toast.error).toHaveBeenCalledWith('La invitación ya fue procesada');
  });

  it('mientras responde, la invitación figura en proceso y no se envía dos veces', async () => {
    let resolve: (res: Response) => void = () => {};
    vi.mocked(apiFetch).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const { result } = renderHook(() => useStaffInvitation());

    let first: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.respond('n1', 'staff-1', 'reject');
    });
    expect(result.current.processingIds.has('n1')).toBe(true);

    await act(() => result.current.respond('n1', 'staff-1', 'reject'));
    expect(apiFetch).toHaveBeenCalledTimes(1);

    vi.mocked(apiFetch).mockResolvedValue(Response.json({}));
    await act(async () => {
      resolve(Response.json({}));
      await first;
    });
    expect(result.current.processingIds.has('n1')).toBe(false);
  });
});
