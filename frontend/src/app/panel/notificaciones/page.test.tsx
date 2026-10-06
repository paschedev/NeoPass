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
  actionUrl: '/panel/staff',
  metadata: { status: 'PENDING', eventStaffId: 'staff-1', role: 'SCANNER' },
};

const notice = (id: string, title: string) => ({
  id,
  type: 'SYSTEM',
  title,
  message: 'Texto del aviso',
  createdAt: '2026-10-06T12:00:00.000Z',
  isRead: true,
  actionUrl: null,
});

// Responde cada página del listado según la URL pedida.
function serve(pages: Record<string, object>) {
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    Response.json(pages[String(url)] ?? {}),
  );
}

const FIRST_PAGE = '/notifications/feed?limit=20';

describe('NotificacionesPage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('al aceptar una invitación de scanner actualiza la sesión con /auth/me', async () => {
    serve({
      [FIRST_PAGE]: {
        items: [scannerInvite],
        nextCursor: null,
        unreadCount: 1,
      },
    });
    render(<NotificacionesPage />);

    fireEvent.click(await screen.findByRole('button', { name: /Aceptar/ }));

    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/events/staff/staff-1/accept', {
        method: 'PUT',
      }),
    );
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith('/auth/me'));
  });

  it('"Cargar más" trae la página siguiente y desaparece cuando no hay más', async () => {
    serve({
      [FIRST_PAGE]: {
        items: [notice('a', 'Aviso nuevo')],
        nextCursor: 'a',
        unreadCount: 0,
      },
      [`${FIRST_PAGE}&cursor=a`]: {
        items: [notice('b', 'Aviso viejo')],
        nextCursor: null,
        unreadCount: 0,
      },
    });
    render(<NotificacionesPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cargar más' }));

    expect(await screen.findByText('Aviso viejo')).toBeInTheDocument();
    expect(screen.getByText('Aviso nuevo')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cargar más' })).toBeNull();
  });

  it('"Solo solicitudes" le pide al servidor solo las invitaciones', async () => {
    serve({
      [FIRST_PAGE]: {
        items: [notice('a', 'Aviso del sistema')],
        nextCursor: null,
        unreadCount: 0,
      },
      [`${FIRST_PAGE}&onlyRequests=true`]: {
        items: [scannerInvite],
        nextCursor: null,
        unreadCount: 1,
      },
    });
    render(<NotificacionesPage />);
    await screen.findByText('Aviso del sistema');

    fireEvent.click(screen.getByRole('switch', { name: 'Solo solicitudes' }));

    expect(
      await screen.findByText('Invitación como Scanner'),
    ).toBeInTheDocument();
    // El aviso que ya no corresponde sale con una animación.
    await waitFor(() =>
      expect(screen.queryByText('Aviso del sistema')).toBeNull(),
    );
  });

  it('tocar un aviso con link lo abre y lo marca como leído', async () => {
    serve({
      [FIRST_PAGE]: {
        items: [scannerInvite],
        nextCursor: null,
        unreadCount: 1,
      },
    });
    render(<NotificacionesPage />);

    const link = await screen.findByRole('link', {
      name: /Invitación como Scanner/,
    });
    fireEvent.click(link);

    expect(link).toHaveAttribute('href', '/panel/staff');
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/notifications/n1/read', {
        method: 'PUT',
      }),
    );
  });

  it('si no se pueden cargar los avisos, lo dice y deja reintentar', async () => {
    vi.mocked(apiFetch).mockResolvedValue(new Response(null, { status: 500 }));
    render(<NotificacionesPage />);

    expect(
      await screen.findByText('No pudimos cargar tus avisos.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});
