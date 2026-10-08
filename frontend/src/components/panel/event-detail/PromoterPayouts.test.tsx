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
import PromoterPayouts from './PromoterPayouts';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const LIST_PATH = '/events/organizer/e1/promoters';
const PAY_PATH = '/events/organizer/e1/promoters/s1/payments';

const rocio = (overrides = {}) => ({
  id: 's1',
  status: 'ACCEPTED',
  name: 'Rocío RPP',
  email: 'rocio@neopass.test',
  commissionType: 'PERCENTAGE',
  commissionValue: 10,
  ticketsSold: 2,
  salesAmount: 2000,
  totalEarned: 200,
  totalPaid: 0,
  balance: 200,
  payments: [],
  ...overrides,
});

// El servidor responde la lista y, si se registra un pago, el resultado.
function server({
  lists,
  payment = Response.json({ amount: 150.5, totalPaid: 150.5, balance: 49.5 }),
}: {
  lists: unknown[][];
  payment?: Response;
}) {
  let listCalls = 0;
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    if (path === LIST_PATH) {
      const list = lists[Math.min(listCalls, lists.length - 1)];
      listCalls += 1;
      return Response.json(list);
    }
    return payment;
  });
}

const paymentCalls = () =>
  vi.mocked(apiFetch).mock.calls.filter(([path]) => path === PAY_PATH);

describe('PromoterPayouts', () => {
  afterEach(() => vi.clearAllMocks());

  it('muestra cada RPP con lo vendido, lo ganado, lo pagado y el saldo', async () => {
    server({ lists: [[rocio({ totalPaid: 50, balance: 150 })]] });

    render(<PromoterPayouts eventId="e1" />);

    const row = await screen.findByRole('row', { name: /Rocío RPP/ });
    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent('$2.000');
    expect(row).toHaveTextContent('$200');
    expect(row).toHaveTextContent('$50');
    expect(row).toHaveTextContent('$150');
  });

  it('un evento sin RPPs lo dice', async () => {
    server({ lists: [[]] });

    render(<PromoterPayouts eventId="e1" />);

    expect(
      await screen.findByText('Este evento no tiene RPPs.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Invitar scanner o RPP' }),
    ).not.toBeInTheDocument();
  });

  it('con un evento abierto a invitaciones, ofrece invitar scanners o RPPs, nunca co-organizadores', async () => {
    server({ lists: [[]] });

    render(
      <PromoterPayouts
        eventId="e1"
        inviteEvent={{ id: 'e1', title: 'Fiesta de prueba' }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Invitar scanner o RPP' }),
    );

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: 'Promotor' }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Co-organizador' }),
    ).not.toBeInTheDocument();
  });

  it('solo el dueño puede habilitar QR free al invitar un RPP', async () => {
    server({ lists: [[]] });
    const { unmount } = render(
      <PromoterPayouts
        eventId="e1"
        inviteEvent={{ id: 'e1', title: 'Fiesta de prueba' }}
        canGrantFreeTickets
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Invitar scanner o RPP' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Promotor' }));
    expect(
      screen.getByRole('checkbox', { name: /Puede mandar QR free/ }),
    ).toBeInTheDocument();
    unmount();

    render(
      <PromoterPayouts
        eventId="e1"
        inviteEvent={{ id: 'e1', title: 'Fiesta de prueba' }}
      />,
    );
    fireEvent.click(
      await screen.findByRole('button', { name: 'Invitar scanner o RPP' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Promotor' }));
    expect(
      screen.queryByRole('checkbox', { name: /Puede mandar QR free/ }),
    ).not.toBeInTheDocument();
  });

  it('registrar un pago propone el saldo, lo manda y actualiza la lista', async () => {
    server({
      lists: [[rocio()], [rocio({ totalPaid: 150.5, balance: 49.5 })]],
    });
    render(<PromoterPayouts eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Registrar pago a Rocío RPP' }),
    );
    const dialog = screen.getByRole('dialog');
    const amount = within(dialog).getByLabelText('Monto');
    expect(amount).toHaveValue('200');
    fireEvent.change(amount, { target: { value: '150,50' } });
    fireEvent.change(within(dialog).getByLabelText('Nota (opcional)'), {
      target: { value: 'Efectivo' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Pago registrado'),
    );
    expect(paymentCalls()).toEqual([
      [
        PAY_PATH,
        {
          method: 'POST',
          body: JSON.stringify({ amount: 150.5, note: 'Efectivo' }),
        },
      ],
    ]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(
      await screen.findByRole('row', { name: /\$49,50/ }),
    ).toBeInTheDocument();
  });

  it('no deja registrar más de lo que se le debe', async () => {
    server({ lists: [[rocio()]] });
    render(<PromoterPayouts eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Registrar pago a Rocío RPP' }),
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), {
      target: { value: '250' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar' }));

    expect(
      await within(dialog).findByText(
        'No puede superar lo que se le debe ($200)',
      ),
    ).toBeInTheDocument();
    expect(paymentCalls()).toHaveLength(0);
  });

  it('si el servidor rechaza el pago muestra el motivo y deja el formulario abierto', async () => {
    server({
      lists: [[rocio()]],
      payment: Response.json(
        { message: 'El pago supera lo que se le debe ($0)' },
        { status: 409 },
      ),
    });
    render(<PromoterPayouts eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Registrar pago a Rocío RPP' }),
    );
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Registrar',
      }),
    );

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'El pago supera lo que se le debe ($0)',
      ),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('un RPP sin saldo no ofrece registrar pagos', async () => {
    server({ lists: [[rocio({ totalPaid: 200, balance: 0 })]] });

    render(<PromoterPayouts eventId="e1" />);

    await screen.findByRole('row', { name: /Rocío RPP/ });
    expect(
      screen.queryByRole('button', { name: /registrar pago/i }),
    ).not.toBeInTheDocument();
  });

  it('muestra el historial de pagos de cada RPP', async () => {
    server({
      lists: [
        [
          rocio({
            totalPaid: 150,
            balance: 50,
            payments: [
              {
                amount: 150,
                note: 'Transferencia',
                createdAt: '2026-10-02T15:00:00.000Z',
              },
            ],
          }),
        ],
      ],
    });
    render(<PromoterPayouts eventId="e1" />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Ver pagos a Rocío RPP (1)' }),
    );

    const history = screen.getByRole('list', { name: 'Pagos a Rocío RPP' });
    expect(history).toHaveTextContent('$150');
    expect(history).toHaveTextContent('Transferencia');
    expect(history).toHaveTextContent('2 oct');
  });
});
