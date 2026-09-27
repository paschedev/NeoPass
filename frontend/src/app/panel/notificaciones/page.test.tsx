import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import NotificacionesPage from './page';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const scannerInvite = {
  id: 'n1',
  type: 'STAFF_INVITE',
  title: 'Invitación como Scanner',
  message: 'Te invitaron a escanear.',
  createdAt: '2026-09-26T12:00:00.000Z',
  isRead: false,
  metadata: { status: 'PENDING', eventStaffId: 'staff-1', role: 'SCANNER' },
};

describe('NotificacionesPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('al aceptar una invitación de scanner actualiza la sesión con /auth/me', async () => {
    vi.mocked(apiFetch).mockImplementation(async (url) =>
      url === '/notifications'
        ? Response.json([scannerInvite])
        : Response.json({}),
    );
    render(<NotificacionesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Aceptar/ }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/events/staff/staff-1/accept', {
        method: 'PUT',
      }),
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/auth/me'));
  });
});
