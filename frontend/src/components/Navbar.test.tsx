import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import Navbar from './Navbar';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/eventos' }));

const transferNotice = {
  id: 'n1',
  type: 'SYSTEM',
  title: 'Te transfirieron una entrada',
  message: 'Recibiste una entrada para Fiesta X.',
  createdAt: '2026-10-06T12:00:00.000Z',
  isRead: false,
  actionUrl: '/panel/tickets',
};

function feed(items: object[] = [], unreadCount = 0) {
  vi.mocked(apiFetch).mockImplementation(async (url) =>
    String(url).startsWith('/notifications/feed')
      ? Response.json({ items, nextCursor: null, unreadCount })
      : Response.json({}),
  );
}

function logIn() {
  localStorage.setItem(
    'user',
    JSON.stringify({ name: 'Ana Gómez', email: 'ana@neopass.test' }),
  );
}

describe('Navbar', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('la marca lleva al inicio', () => {
    render(<Navbar />);

    expect(screen.getByRole('link', { name: 'NeoPass' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('sin sesión ofrece ingresar y no pide notificaciones', () => {
    render(<Navbar />);

    expect(screen.getByRole('link', { name: 'Ingresar' })).toBeInTheDocument();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('con sesión muestra al usuario y trae sus últimos avisos', async () => {
    logIn();
    feed();

    render(<Navbar />);

    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ingresar' })).toBeNull();
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/notifications/feed?limit=3'),
    );
  });

  it('la campana cuenta todos los avisos nuevos, aunque muestre solo los últimos', async () => {
    logIn();
    feed([transferNotice], 5);

    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByText('5 nuevas')).toBeInTheDocument();
  });

  it('tocar un aviso con link lo abre y lo marca como leído', async () => {
    logIn();
    feed([transferNotice], 1);

    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    const link = await screen.findByRole('link', {
      name: /Te transfirieron una entrada/,
    });
    fireEvent.click(link);

    expect(link).toHaveAttribute('href', '/panel/tickets');
    await waitFor(() =>
      expect(apiFetch).toHaveBeenCalledWith('/notifications/n1/read', {
        method: 'PUT',
      }),
    );
  });

  it('un aviso con un link externo no se puede tocar', async () => {
    logIn();
    feed([{ ...transferNotice, actionUrl: 'https://otro-sitio.test' }], 1);

    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(
      await screen.findByText('Te transfirieron una entrada'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /Te transfirieron una entrada/ }),
    ).toBeNull();
  });

  it('el link de soporte del menú abre un mail a soporte@neopass.ar', async () => {
    logIn();
    feed();

    render(<Navbar />);
    fireEvent.click(screen.getByText('Ana'));

    expect(
      await screen.findByRole('link', { name: 'Soporte' }),
    ).toHaveAttribute('href', 'mailto:soporte@neopass.ar');
  });

  it('con foto de perfil la muestra en el botón del perfil', () => {
    localStorage.setItem(
      'user',
      JSON.stringify({
        name: 'Ana Gómez',
        email: 'ana@neopass.test',
        avatarUrl:
          'https://res.cloudinary.com/neopass/image/upload/v1/avatars/u1.jpg',
      }),
    );
    feed();

    render(<Navbar />);

    expect(screen.getByRole('img', { name: 'Ana Gómez' })).toBeInTheDocument();
  });

  it('el menú del perfil no repite "Mi panel": queda solo el de la barra', async () => {
    logIn();
    feed();

    render(<Navbar />);
    fireEvent.click(screen.getByText('Ana'));

    expect(
      await screen.findByRole('link', { name: 'Perfil' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Cerrar sesión' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Mi panel' })).toHaveLength(1);
  });
});
