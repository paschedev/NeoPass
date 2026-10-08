import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import MyStaffEvents from './MyStaffEvents';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const MY_STAFF_PATH = '/events/staff/me';

const promoter = (overrides = {}) => ({
  staffId: 's1',
  commissionType: 'PERCENTAGE',
  commissionValue: 10,
  ticketsSold: 38,
  totalEarned: 41800,
  totalPaid: 20000,
  balance: 21800,
  freeTickets: null,
  ...overrides,
});

const event = (overrides = {}) => ({
  id: 'e1',
  title: 'Fiesta Bresh',
  status: 'PUBLISHED',
  startDate: '2026-10-11T02:59:00Z',
  endDate: '2026-10-11T08:00:00Z',
  phase: 'NOT_STARTED',
  venueName: 'Niceto Club',
  venueAddress: 'Av. Cnel. Niceto Vega 5510',
  venueCity: 'CABA',
  latitude: -34.5866,
  longitude: -58.4381,
  venuePlaceId: 'place-1',
  organizerName: 'Organizadora',
  owed: 21800,
  roles: ['PROMOTER', 'SCANNER'],
  promoter: promoter(),
  coOrganizer: null,
  ...overrides,
});

const myStaff = (overrides = {}) => ({
  promoterTotals: {
    totalEarned: 41800,
    totalPaid: 20000,
    owed: 21800,
    ticketsSold: 38,
  },
  invitations: [],
  events: [event()],
  ...overrides,
});

// El servidor responde las listas en orden (la última se repite) y acepta o
// rechaza invitaciones.
function server(responses: (object | Response)[]) {
  let calls = 0;
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === MY_STAFF_PATH) {
      const next = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      return next instanceof Response ? next : Response.json(next);
    }
    if (path === '/auth/me') return Response.json({ role: 'CUSTOMER' });
    return Response.json({});
  });
}

const card = (title: string) => screen.findByRole('article', { name: title });

describe('MyStaffEvents', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'jwt');
    localStorage.setItem('user', JSON.stringify({ role: 'CUSTOMER' }));
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('muestra cada evento con sus roles, la fecha, el lugar y quién organiza', async () => {
    server([myStaff()]);

    render(<MyStaffEvents />);

    const fiesta = await card('Fiesta Bresh');
    expect(fiesta).toHaveTextContent('Próximo');
    expect(fiesta).toHaveTextContent('sáb, 10 oct, 23:59');
    expect(fiesta).toHaveTextContent('RPP');
    expect(fiesta).toHaveTextContent('Scanner');
    expect(fiesta).toHaveTextContent('Niceto Club');
    expect(fiesta).toHaveTextContent('Organiza Organizadora');
    expect(
      within(fiesta).getByRole('link', { name: 'Cómo llegar' }),
    ).toHaveAttribute(
      'href',
      expect.stringContaining('query_place_id=place-1'),
    );
  });

  it('como RPP muestra la comisión, lo vendido, lo ganado y lo que le deben, y lleva a sus ventas', async () => {
    server([myStaff()]);

    render(<MyStaffEvents />);

    const fiesta = await card('Fiesta Bresh');
    expect(fiesta).toHaveTextContent('10% por entrada');
    expect(fiesta).toHaveTextContent('Vendidas38');
    expect(fiesta).toHaveTextContent('Ganaste$41.800');
    expect(fiesta).toHaveTextContent('Te pagaron$20.000');
    expect(fiesta).toHaveTextContent('Te deben$21.800');
    expect(
      within(fiesta).getByRole('link', { name: 'Ver mis ventas' }),
    ).toHaveAttribute('href', '/panel/rpp/e1');
  });

  it('como RPP con QR free muestra cuántos le quedan y lleva a mandarlos mientras el evento no terminó', async () => {
    server([
      myStaff({
        events: [
          event({
            promoter: promoter({ freeTickets: { limit: 10, sent: 3 } }),
          }),
          event({
            id: 'e2',
            title: 'Halloween',
            phase: 'CLOSED',
            promoter: promoter({
              staffId: 's2',
              freeTickets: { limit: 4, sent: 4 },
            }),
          }),
          event({ id: 'e3', title: 'Sunset' }),
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    const fiesta = await card('Fiesta Bresh');
    expect(fiesta).toHaveTextContent('QR free: te quedan 7 de 10');
    expect(
      within(fiesta).getByRole('link', { name: 'Mandar QR free' }),
    ).toHaveAttribute('href', '/panel/rpp/e1#qr-free');
    const halloween = await card('Halloween');
    expect(halloween).toHaveTextContent('QR free: te quedan 0 de 4');
    expect(
      within(halloween).queryByRole('link', { name: 'Mandar QR free' }),
    ).toBeNull();
    expect(await card('Sunset')).not.toHaveTextContent('QR free');
  });

  it('la invitación de RPP dice cuántos QR free vas a poder mandar', async () => {
    server([
      myStaff({
        invitations: [
          {
            id: 'i1',
            role: 'PROMOTER',
            commissionType: 'PERCENTAGE',
            commissionValue: 10,
            permissions: ['SEND_FREE_TICKETS'],
            freeTicketLimit: 10,
            event: {
              id: 'e9',
              title: 'Sunset',
              startDate: '2026-10-11T02:59:00Z',
              organizerName: 'Organizadora',
            },
          },
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    expect(
      await screen.findByRole('region', { name: 'Invitaciones pendientes' }),
    ).toHaveTextContent('Vas a poder mandar hasta 10 QR free');
  });

  it('"Copiar link" copia el link de venta y no aparece en eventos terminados', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    server([
      myStaff({
        events: [
          event(),
          event({
            id: 'e2',
            title: 'Halloween',
            phase: 'CLOSED',
            promoter: promoter({ staffId: 's2' }),
          }),
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    fireEvent.click(
      within(await card('Fiesta Bresh')).getByRole('button', {
        name: 'Copiar link',
      }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/eventos/e1?rpp=s1`,
      ),
    );
    expect(
      within(await card('Halloween')).queryByRole('button', {
        name: 'Copiar link',
      }),
    ).toBeNull();
  });

  it('"Escanear" aparece solo con el evento en curso', async () => {
    server([
      myStaff({
        promoterTotals: null,
        events: [
          event({ roles: ['SCANNER'], promoter: null, owed: 0 }),
          event({
            id: 'e2',
            title: 'Sunset',
            phase: 'IN_PROGRESS',
            roles: ['MANAGER'],
            promoter: null,
            owed: 0,
          }),
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    expect(
      within(await card('Sunset')).getByRole('link', { name: 'Escanear' }),
    ).toHaveAttribute('href', '/panel/escanear');
    expect(await card('Sunset')).toHaveTextContent('Co-organizador');
    expect(
      within(await card('Fiesta Bresh')).queryByRole('link', {
        name: 'Escanear',
      }),
    ).toBeNull();
  });

  it('un evento que co-organizás muestra lo que podés hacer y "Gestionar" lleva a su detalle', async () => {
    server([
      myStaff({
        promoterTotals: null,
        events: [
          event({
            roles: ['MANAGER'],
            promoter: null,
            owed: 0,
            coOrganizer: {
              permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS'],
              freeTicketLimit: 10,
            },
          }),
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    const fiesta = await card('Fiesta Bresh');
    expect(fiesta).toHaveTextContent(
      'Podés: Escanear · Ver ventas · QR free (hasta 10)',
    );
    expect(
      within(fiesta).getByRole('link', { name: 'Gestionar' }),
    ).toHaveAttribute('href', '/panel/eventos/e1');
  });

  it('la invitación de co-organizador dice qué vas a poder hacer', async () => {
    server([
      myStaff({
        invitations: [
          {
            id: 'i1',
            role: 'MANAGER',
            commissionType: null,
            commissionValue: null,
            permissions: ['EDIT_EVENT'],
            freeTicketLimit: null,
            event: {
              id: 'e9',
              title: 'Sunset',
              startDate: '2026-10-11T02:59:00Z',
              organizerName: 'Organizadora',
            },
          },
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    expect(
      await screen.findByRole('region', { name: 'Invitaciones pendientes' }),
    ).toHaveTextContent('Vas a poder: Escanear · Editar info');
  });

  it('arriba muestra los totales de RPP solo si tiene roles de RPP', async () => {
    server([myStaff()]);
    const { unmount } = render(<MyStaffEvents />);

    const totals = await screen.findByRole('region', {
      name: 'Tus números como RPP',
    });
    expect(totals).toHaveTextContent('Te deben$21.800');
    expect(totals).toHaveTextContent('Te pagaron$20.000');
    expect(totals).toHaveTextContent('Ganaste$41.800');
    expect(totals).toHaveTextContent('Entradas vendidas38');
    unmount();

    server([
      myStaff({
        promoterTotals: null,
        events: [event({ roles: ['SCANNER'], promoter: null, owed: 0 })],
      }),
    ]);
    render(<MyStaffEvents />);
    await card('Fiesta Bresh');
    expect(
      screen.queryByRole('region', { name: 'Tus números como RPP' }),
    ).toBeNull();
  });

  it('los eventos terminados sin nada que cobrar quedan plegados al final', async () => {
    server([
      myStaff({
        events: [
          event(),
          event({ id: 'e2', title: 'Halloween', phase: 'CLOSED', owed: 500 }),
          event({ id: 'e3', title: 'Primavera', phase: 'CLOSED', owed: 0 }),
        ],
      }),
    ]);

    render(<MyStaffEvents />);

    expect(await card('Halloween')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Primavera' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Terminados · 1' }));
    expect(await card('Primavera')).toBeInTheDocument();
  });

  it('aceptar una invitación pendiente la confirma y recarga la lista', async () => {
    const invitation = {
      id: 'inv1',
      role: 'PROMOTER',
      commissionType: 'FIXED',
      commissionValue: 1500,
      event: {
        id: 'e9',
        title: 'Techno Sunset',
        startDate: '2026-10-25T03:30:00Z',
        organizerName: 'Otra organizadora',
      },
    };
    server([
      myStaff({ invitations: [invitation] }),
      myStaff({
        events: [event(), event({ id: 'e9', title: 'Techno Sunset' })],
      }),
    ]);
    render(<MyStaffEvents />);

    const pending = await screen.findByRole('region', {
      name: 'Invitaciones pendientes',
    });
    expect(pending).toHaveTextContent('Techno Sunset');
    expect(pending).toHaveTextContent('RPP · $1.500 por entrada');
    expect(pending).toHaveTextContent('Organiza Otra organizadora');
    fireEvent.click(within(pending).getByRole('button', { name: 'Aceptar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Invitación aceptada'),
    );
    expect(apiFetch).toHaveBeenCalledWith('/events/staff/inv1/accept', {
      method: 'PUT',
    });
    expect(await card('Techno Sunset')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Invitaciones pendientes' }),
    ).toBeNull();
  });

  it('si falla la carga lo dice y deja reintentar', async () => {
    server([new Response(null, { status: 500 }), myStaff()]);
    render(<MyStaffEvents />);

    expect(
      await screen.findByText('No pudimos cargar tus eventos.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await card('Fiesta Bresh')).toBeInTheDocument();
  });

  it('sin eventos ni invitaciones explica qué va a aparecer', async () => {
    server([myStaff({ promoterTotals: null, events: [] })]);
    render(<MyStaffEvents />);

    expect(
      await screen.findByText('Todavía no trabajás en ningún evento'),
    ).toBeInTheDocument();
  });
});
