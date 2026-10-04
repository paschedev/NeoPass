import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import StaffTab from './StaffTab';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const OVERVIEW_PATH = '/events/organizer/staff/overview';
const PAY_PATH = '/events/organizer/e1/promoters/s1/payments';

const sofia = (overrides = {}) => ({
  id: 's1',
  status: 'ACCEPTED',
  name: 'Sofía Martínez',
  email: 'sofi@neopass.test',
  commissionType: 'PERCENTAGE',
  commissionValue: 10,
  ticketsSold: 38,
  totalEarned: 41800,
  totalPaid: 20000,
  balance: 21800,
  owedAcrossEvents: { amount: 29000, events: 2 },
  payments: [
    { amount: 20000, note: 'Transferencia', createdAt: '2026-10-02T15:00:00Z' },
  ],
  ...overrides,
});

const person = (id: string, name: string, status = 'ACCEPTED') => ({
  id,
  status,
  name,
  email: `${id}@neopass.test`,
});

const group = (overrides = {}) => ({
  id: 'e1',
  title: 'Fiesta Bresh',
  status: 'PUBLISHED',
  startDate: '2026-10-11T02:59:00Z',
  endDate: '2026-10-11T08:00:00Z',
  phase: 'NOT_STARTED',
  owed: 21800,
  promoters: [sofia()],
  scanners: [person('m1', 'Martín Pérez')],
  managers: [],
  ...overrides,
});

const overview = (events: unknown[], totals = {}) => ({
  totals: {
    owed: 21800,
    paid: 20000,
    earned: 41800,
    promotersOwed: 1,
    eventsOwed: 1,
    activeStaff: 2,
    pendingInvitations: 0,
    ...totals,
  },
  events,
});

// El servidor responde los resúmenes en orden (el último se repite) y, si se
// registra un pago, el resultado.
function server(
  responses: (object | Response)[],
  payment = Response.json({ amount: 21800, totalPaid: 41800, balance: 0 }),
) {
  let calls = 0;
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path !== OVERVIEW_PATH) return payment;
    const next = responses[Math.min(calls, responses.length - 1)];
    calls += 1;
    return next instanceof Response ? next : Response.json(next);
  });
}

const renderTab = (onInvite = vi.fn()) =>
  render(<StaffTab refreshKey={0} onInvite={onInvite} />);

const eventGroup = (title: string) =>
  screen.findByRole('region', { name: title });

describe('StaffTab', () => {
  afterEach(() => vi.clearAllMocks());

  it('muestra el resumen: lo que les debés a tus RPPs, lo que ya pagaste y el staff activo', async () => {
    server([
      overview([group()], {
        owed: 85300,
        paid: 114000,
        earned: 199300,
        promotersOwed: 2,
        eventsOwed: 3,
        activeStaff: 9,
        pendingInvitations: 3,
      }),
    ]);

    renderTab();

    const summary = await screen.findByRole('region', {
      name: 'Resumen del staff',
    });
    expect(summary).toHaveTextContent('Les debés a tus RPPs');
    expect(summary).toHaveTextContent('$85.300');
    expect(summary).toHaveTextContent('2 RPPs · 3 eventos');
    expect(summary).toHaveTextContent('$114.000');
    expect(summary).toHaveTextContent('57% de $199.300 en comisiones');
    expect(summary).toHaveTextContent('9 personas');
    expect(summary).toHaveTextContent('3 invitaciones sin responder');
  });

  it('agrupa por evento con su etapa, su fecha, su staff y lo que debe', async () => {
    server([
      overview([
        group({
          promoters: [sofia(), sofia({ id: 's2', name: 'Tomás Rivas' })],
          owed: 43600,
        }),
      ]),
    ]);

    renderTab();

    const fiesta = await eventGroup('Fiesta Bresh');
    expect(fiesta).toHaveTextContent('Próximo');
    expect(fiesta).toHaveTextContent('sáb, 10 oct, 23:59');
    expect(fiesta).toHaveTextContent('2 RPPs · 1 scanner');
    expect(fiesta).toHaveTextContent('Deuda del evento');
    expect(fiesta).toHaveTextContent('$43.600');
    expect(
      within(fiesta).getByRole('list', { name: 'Scanners' }),
    ).toHaveTextContent('Martín Pérez');
  });

  it('la tarjeta del RPP muestra lo vendido, lo ganado, lo pagado, lo que se le debe y el total entre eventos', async () => {
    server([overview([group()])]);

    renderTab();

    const card = await screen.findByRole('article', { name: 'Sofía Martínez' });
    expect(card).toHaveTextContent('10% por entrada');
    expect(card).toHaveTextContent('Vendidas38');
    expect(card).toHaveTextContent('Ganó$41.800');
    expect(card).toHaveTextContent('Pagado$20.000');
    expect(card).toHaveTextContent('Le debés$21.800');
    expect(card).toHaveTextContent('En total le debés $29.000 en 2 eventos');
  });

  it('un RPP al día lo dice y no ofrece registrar pagos; uno pagado de más lo aclara', async () => {
    server([
      overview([
        group({
          owed: 0,
          promoters: [
            sofia({
              balance: 0,
              totalPaid: 41800,
              owedAcrossEvents: { amount: 0, events: 0 },
            }),
            sofia({
              id: 's2',
              name: 'Tomás Rivas',
              totalEarned: 1000,
              totalPaid: 1500,
              balance: -500,
              owedAcrossEvents: { amount: 0, events: 0 },
            }),
          ],
        }),
      ]),
    ]);

    renderTab();

    const sofi = await screen.findByRole('article', { name: 'Sofía Martínez' });
    expect(sofi).toHaveTextContent('Al día');
    expect(
      within(sofi).queryByRole('button', { name: /Registrar pago/ }),
    ).toBeNull();
    expect(
      screen.getByRole('article', { name: 'Tomás Rivas' }),
    ).toHaveTextContent('Le pagaste $500 de más');
    expect(await eventGroup('Fiesta Bresh')).toHaveTextContent('Al día');
  });

  it('las invitaciones pendientes y rechazadas aparecen con su etiqueta y sin montos', async () => {
    server([
      overview([
        group({
          promoters: [
            sofia(),
            sofia({
              id: 's2',
              name: 'Lucía Gómez',
              status: 'PENDING',
              commissionValue: 12,
            }),
          ],
          scanners: [person('r1', 'Rodrigo Díaz', 'REJECTED')],
        }),
      ]),
    ]);

    renderTab();

    const lucia = await screen.findByRole('article', { name: 'Lucía Gómez' });
    expect(lucia).toHaveTextContent('Pendiente');
    expect(lucia).toHaveTextContent('Todavía no aceptó · 12% por entrada');
    expect(lucia).not.toHaveTextContent('Le debés');
    const scanners = screen.getByRole('list', { name: 'Scanners' });
    expect(scanners).toHaveTextContent('Rodrigo Díaz');
    expect(scanners).toHaveTextContent('Rechazó');
  });

  it('avisa "Sin scanners" en los eventos que no terminaron y no tienen quién controle la puerta', async () => {
    server([
      overview([
        group({ scanners: [person('m1', 'Martín Pérez', 'PENDING')] }),
        group({
          id: 'e2',
          title: 'Halloween',
          phase: 'CLOSED',
          owed: 500,
          scanners: [],
        }),
      ]),
    ]);

    renderTab();

    expect(await eventGroup('Fiesta Bresh')).toHaveTextContent('Sin scanners');
    expect(await eventGroup('Halloween')).not.toHaveTextContent('Sin scanners');
  });

  it('"Con deuda" deja solo los eventos donde les debés algo', async () => {
    server([
      overview([
        group(),
        group({ id: 'e2', title: 'Techno Sunset', owed: 0, promoters: [] }),
      ]),
    ]);

    renderTab();
    await eventGroup('Techno Sunset');

    fireEvent.click(screen.getByRole('button', { name: /Con deuda/ }));

    expect(
      screen.getByRole('region', { name: 'Fiesta Bresh' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Techno Sunset' })).toBeNull();
  });

  it('si no les debés nada, "Con deuda" lo dice', async () => {
    server([overview([group({ owed: 0 })], { owed: 0, eventsOwed: 0 })]);

    renderTab();
    await eventGroup('Fiesta Bresh');

    fireEvent.click(screen.getByRole('button', { name: /Con deuda/ }));

    expect(
      screen.getByText('No les debés nada a tus RPPs.'),
    ).toBeInTheDocument();
  });

  it('los eventos terminados al día quedan plegados al final y se despliegan al tocarlos', async () => {
    server([
      overview([
        group(),
        group({
          id: 'e2',
          title: 'Primavera Fest',
          phase: 'CLOSED',
          owed: 0,
          promoters: [],
        }),
      ]),
    ]);

    renderTab();
    await eventGroup('Fiesta Bresh');
    expect(screen.queryByRole('region', { name: 'Primavera Fest' })).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'Finalizados al día · 1' }),
    );

    expect(
      screen.getByRole('region', { name: 'Primavera Fest' }),
    ).toBeInTheDocument();
  });

  it('se puede plegar el staff de un evento', async () => {
    server([overview([group()])]);

    renderTab();
    const fiesta = await eventGroup('Fiesta Bresh');
    fireEvent.click(within(fiesta).getByRole('button', { name: 'Ocultar' }));

    expect(
      within(fiesta).queryByRole('article', { name: 'Sofía Martínez' }),
    ).toBeNull();
    expect(fiesta).toHaveTextContent('$21.800');
  });

  it('registrar un pago lo anota en el evento del RPP y recarga los montos', async () => {
    server([
      overview([group()]),
      overview([
        group({
          owed: 0,
          promoters: [
            sofia({
              totalPaid: 41800,
              balance: 0,
              owedAcrossEvents: { amount: 7200, events: 1 },
            }),
          ],
        }),
      ]),
    ]);
    renderTab();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Registrar pago a Sofía Martínez',
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Monto')).toHaveValue('21800');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Pago registrado'),
    );
    expect(
      vi.mocked(apiFetch).mock.calls.filter(([path]) => path === PAY_PATH),
    ).toEqual([
      [PAY_PATH, { method: 'POST', body: JSON.stringify({ amount: 21800, note: null }) }],
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const card = await screen.findByRole('article', { name: 'Sofía Martínez' });
    await waitFor(() =>
      expect(card).toHaveTextContent('En otros eventos le debés $7.200'),
    );
  });

  it('si el servidor rechaza el pago muestra el motivo y deja el formulario abierto', async () => {
    server(
      [overview([group()])],
      Response.json(
        { message: 'El pago supera lo que se le debe ($100)' },
        { status: 409 },
      ),
    );
    renderTab();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Registrar pago a Sofía Martínez',
      }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Registrar',
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'El pago supera lo que se le debe ($100)',
      ),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('muestra el historial de pagos de cada RPP', async () => {
    server([overview([group()])]);
    renderTab();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Ver pagos a Sofía Martínez (1)',
      }),
    );

    const history = screen.getByRole('list', {
      name: 'Pagos a Sofía Martínez',
    });
    expect(history).toHaveTextContent('Transferencia');
    expect(history).toHaveTextContent('$20.000');
  });

  it('invitar desde un evento avisa cuál, y desde "Sin scanners" también el rol', async () => {
    const onInvite = vi.fn();
    server([
      overview([
        group({ scanners: [] }),
        group({ id: 'e2', title: 'Halloween', phase: 'CLOSED', owed: 500 }),
      ]),
    ]);
    renderTab(onInvite);

    const fiesta = await eventGroup('Fiesta Bresh');
    fireEvent.click(
      within(fiesta).getByRole('button', { name: 'Invitar a Fiesta Bresh' }),
    );
    fireEvent.click(
      within(fiesta).getByRole('button', {
        name: 'Sin scanners: invitar un scanner a Fiesta Bresh',
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar invitación' }));

    expect(onInvite.mock.calls).toEqual([
      [{ eventId: 'e1' }],
      [{ eventId: 'e1', role: 'SCANNER' }],
      [],
    ]);
    expect(
      within(await eventGroup('Halloween')).queryByRole('button', {
        name: /Invitar/,
      }),
    ).toBeNull();
  });

  it('cada evento lleva a su detalle', async () => {
    server([overview([group()])]);
    renderTab();

    expect(
      within(await eventGroup('Fiesta Bresh')).getByRole('link', {
        name: 'Ver detalle',
      }),
    ).toHaveAttribute('href', '/panel/eventos/e1');
  });

  it('si falla la carga lo dice y deja reintentar', async () => {
    server([new Response(null, { status: 500 }), overview([group()])]);
    renderTab();

    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));

    expect(await eventGroup('Fiesta Bresh')).toBeInTheDocument();
    expect(screen.queryByText(/No pudimos cargar tu staff/)).toBeNull();
  });

  it('si falla la carga muestra el error', async () => {
    server([new Response(null, { status: 500 })]);
    renderTab();

    expect(
      await screen.findByText('No pudimos cargar tu staff.'),
    ).toBeInTheDocument();
  });

  it('sin eventos ni staff explica cómo empezar', async () => {
    server([overview([], { owed: 0, paid: 0, earned: 0 })]);
    renderTab();

    expect(
      await screen.findByText('No tenés staff asignado'),
    ).toBeInTheDocument();
  });
});
