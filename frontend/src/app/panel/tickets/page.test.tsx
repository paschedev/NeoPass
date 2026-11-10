import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import MisEntradasPage from './page';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));

const ticket = (
  id: string,
  title: string,
  start: string,
  end: string,
  freeTicket: { validUntil: string | null } | null = null,
) => ({
  id,
  status: 'VALID',
  qrCode: `qr-${id}`,
  freeTicket,
  ticketType: {
    name: 'General',
    event: {
      title,
      startDate: start,
      endDate: end,
      status: 'PUBLISHED',
      venueName: null,
      deletion: null,
    },
  },
});

const user = {
  id: 'u1',
  email: 'ana@gmail.com',
  name: 'Ana Pérez',
  role: 'CUSTOMER',
  hasLinkedMp: false,
  hasBeenRpp: false,
  isCurrentlyScanner: false,
};

function logIn(changes: object) {
  localStorage.setItem('token', 'token');
  localStorage.setItem('user', JSON.stringify({ ...user, ...changes }));
}

// Cada ruta responde lo que devuelve su función en ese momento: así una
// segunda carga puede traer otra cosa.
function mockApi(routes: Record<string, () => unknown>) {
  vi.mocked(apiFetch).mockImplementation(async (path: string) => {
    const route = routes[path];
    if (!route) throw new Error(`Ruta sin simular: ${path}`);
    return Response.json(route());
  });
}

const LOCKED_CARD = /Entrada de regalo bloqueada/;

describe('Mis entradas', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('las entradas de eventos terminados quedan en un historial colapsado que se abre al tocarlo', async () => {
    mockApi({
      '/tickets/my-tickets': () => [
        ticket(
          'pasada',
          'Fiesta de invierno',
          '2026-01-10T23:00:00.000Z',
          '2026-01-11T07:00:00.000Z',
        ),
        ticket(
          'vigente',
          'Fiesta de primavera',
          '2099-10-10T23:00:00.000Z',
          '2099-10-11T07:00:00.000Z',
        ),
      ],
      '/tickets/my-tickets/locked': () => ({ count: 0 }),
    });

    render(<MisEntradasPage />);

    expect(await screen.findByText('Fiesta de primavera')).toBeInTheDocument();
    expect(screen.queryByText('Fiesta de invierno')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Historial \(1\)/ }));

    expect(screen.getByText('Fiesta de invierno')).toBeInTheDocument();
  });

  it('sin entradas vigentes pero con historial, avisa que no hay próximas', async () => {
    mockApi({
      '/tickets/my-tickets': () => [
        ticket(
          'pasada',
          'Fiesta de invierno',
          '2026-01-10T23:00:00.000Z',
          '2026-01-11T07:00:00.000Z',
        ),
      ],
      '/tickets/my-tickets/locked': () => ({ count: 0 }),
    });

    render(<MisEntradasPage />);

    expect(
      await screen.findByText('No tenés entradas para próximos eventos.'),
    ).toBeInTheDocument();
  });

  it('con el correo confirmado no hay aviso ni entradas bloqueadas', async () => {
    logIn({ emailVerified: true });
    mockApi({
      '/tickets/my-tickets': () => [],
      '/tickets/my-tickets/locked': () => ({ count: 0 }),
    });

    render(<MisEntradasPage />);

    expect(await screen.findByText('No tenés entradas')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('sin confirmar el correo y sin regalos, invita a confirmarlo por si le regalan entradas', async () => {
    logIn({ emailVerified: false });
    mockApi({
      '/tickets/my-tickets': () => [],
      '/tickets/my-tickets/locked': () => ({ count: 0 }),
    });

    render(<MisEntradasPage />);

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Si te regalan entradas a tu correo, las vas a ver acá cuando lo confirmes.',
    );
    expect(screen.getByText('No tenés entradas')).toBeInTheDocument();
  });

  it('las entradas de regalo con el correo sin confirmar se ven bloqueadas y tocarlas abre la confirmación', async () => {
    logIn({ emailVerified: false });
    mockApi({
      '/tickets/my-tickets': () => [],
      '/tickets/my-tickets/locked': () => ({ count: 2 }),
    });

    render(<MisEntradasPage />);

    expect(
      await screen.findByText('Tenés 2 entradas de regalo bloqueadas'),
    ).toBeInTheDocument();
    const cards = screen.getAllByRole('button', { name: LOCKED_CARD });
    expect(cards).toHaveLength(2);
    expect(screen.queryByText('No tenés entradas')).not.toBeInTheDocument();

    fireEvent.click(cards[0]);

    expect(
      screen.getByRole('heading', { name: 'Confirmá tu correo' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana@gmail.com')).toBeInTheDocument();
  });

  it('confirmar el correo desde ahí desbloquea las entradas de regalo', async () => {
    logIn({ emailVerified: false });
    let confirmed = false;
    mockApi({
      '/tickets/my-tickets': () =>
        confirmed
          ? [
              ticket(
                'regalo',
                'Fiesta de primavera',
                '2099-10-10T23:00:00.000Z',
                '2099-10-11T07:00:00.000Z',
                { validUntil: null },
              ),
            ]
          : [],
      '/tickets/my-tickets/locked': () => ({ count: confirmed ? 0 : 1 }),
      '/auth/email/verification': () => ({ sentTo: 'ana@gmail.com' }),
      '/auth/email/confirm': () => {
        confirmed = true;
        return { ...user, emailVerified: true };
      },
    });

    render(<MisEntradasPage />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmar mi correo' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mandarme el código' }));
    fireEvent.change(await screen.findByLabelText('Código'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Fiesta de primavera')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: LOCKED_CARD }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(apiFetch).toHaveBeenCalledWith('/auth/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: '123456' }),
    });
  });
});
