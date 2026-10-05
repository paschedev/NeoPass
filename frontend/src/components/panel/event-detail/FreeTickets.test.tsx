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
import FreeTickets from './FreeTickets';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const PATH = '/events/organizer/e1/free-tickets';

const EVENT = {
  startDate: '2026-10-11T02:00:00.000Z', // sáb 23:00 en Argentina
  endDate: '2026-10-11T08:00:00.000Z', // dom 05:00
};

const TICKET_TYPES = [
  { id: 't1', label: 'General · Preventa' },
  { id: 't2', label: 'VIP · Preventa' },
];

const grant = (overrides = {}) => ({
  id: 'g1',
  recipientEmail: 'ana@example.com',
  recipientName: 'Ana',
  ticketType: { id: 't1', name: 'General' },
  quantity: 3,
  checkedIn: 1,
  status: 'ACTIVE',
  validUntil: '2026-10-11T04:00:00.000Z', // dom 01:00
  createdAt: '2026-10-05T15:00:00.000Z',
  lastSentAt: '2026-10-05T15:00:00.000Z',
  issuedById: 'u-owner',
  issuedBy: { name: 'Dueña' },
  ...overrides,
});

// El servidor responde la lista (una por cada carga) y las acciones.
function server({
  lists,
  action = Response.json(grant()),
}: {
  lists: unknown[][];
  action?: Response;
}) {
  let listCalls = 0;
  vi.mocked(apiFetch).mockImplementation(async (path, init) => {
    if (path === PATH && !init?.method) {
      const list = lists[Math.min(listCalls, lists.length - 1)];
      listCalls += 1;
      return Response.json(list);
    }
    return action;
  });
}

const callsTo = (path: string) =>
  vi
    .mocked(apiFetch)
    .mock.calls.filter(
      ([called, init]) => called === path && init?.method === 'POST',
    );

function renderSection(sendBlockedReason: string | null = null) {
  render(
    <FreeTickets
      eventId="e1"
      event={EVENT}
      ticketTypes={TICKET_TYPES}
      sendBlockedReason={sendBlockedReason}
    />,
  );
}

describe('FreeTickets', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('a un co-organizador con tope le dice cuántos QR free le quedan', async () => {
    server({ lists: [[grant({ quantity: 3 })]] });

    render(
      <FreeTickets
        eventId="e1"
        event={EVENT}
        ticketTypes={TICKET_TYPES}
        sendBlockedReason={null}
        limit={10}
      />,
    );

    expect(
      await screen.findByText('Te quedan 7 de tus 10 QR free.'),
    ).toBeInTheDocument();
  });

  it('el dueño ve quién mandó cada envío que no mandó él', async () => {
    server({
      lists: [
        [
          grant(),
          grant({
            id: 'g2',
            recipientEmail: 'beto@example.com',
            issuedById: 'u-ana',
            issuedBy: { name: 'Ana Pérez' },
          }),
        ],
      ],
    });

    render(
      <FreeTickets
        eventId="e1"
        event={EVENT}
        ticketTypes={TICKET_TYPES}
        sendBlockedReason={null}
        ownerId="u-owner"
      />,
    );

    expect(
      await screen.findByRole('listitem', { name: 'beto@example.com' }),
    ).toHaveTextContent('Mandó Ana Pérez');
    expect(
      screen.getByRole('listitem', { name: 'ana@example.com' }),
    ).not.toHaveTextContent('Mandó');
  });

  it('sin tope no muestra cuántos quedan, ni quién mandó (el co-organizador ve solo lo suyo)', async () => {
    server({
      lists: [
        [grant({ issuedById: 'u-ana', issuedBy: { name: 'Ana Pérez' } })],
      ],
    });

    renderSection();

    await screen.findByRole('listitem', { name: 'ana@example.com' });
    expect(screen.queryByText(/Te quedan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Mandó/)).not.toBeInTheDocument();
  });

  it('lista los envíos con el correo, el tipo, cuántas ingresaron y hasta cuándo valen', async () => {
    server({ lists: [[grant()]] });

    renderSection();

    const item = await screen.findByRole('listitem', {
      name: /ana@example.com/,
    });
    expect(item).toHaveTextContent('Ana');
    expect(item).toHaveTextContent('General');
    expect(item).toHaveTextContent('1 de 3 ingresaron');
    expect(item).toHaveTextContent('Hasta dom, 11 oct, 01:00');
  });

  it('suma lo enviado y lo que ingresó, sin contar las anuladas que no se usaron', async () => {
    server({
      lists: [
        [
          grant(),
          grant({
            id: 'g2',
            recipientEmail: 'otra@example.com',
            status: 'CANCELLED',
            quantity: 2,
            checkedIn: 0,
          }),
        ],
      ],
    });

    renderSection();

    expect(
      await screen.findByText('3 entradas enviadas · 1 ingresó'),
    ).toBeInTheDocument();
  });

  it('un evento sin envíos lo dice', async () => {
    server({ lists: [[]] });

    renderSection();

    expect(
      await screen.findByText('Todavía no mandaste QR free.'),
    ).toBeInTheDocument();
  });

  it('manda QR free con los datos del formulario y actualiza la lista', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-10T15:00:00.000Z'));
    server({ lists: [[], [grant()]] });
    renderSection();
    await screen.findByText('Todavía no mandaste QR free.');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar QR free' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Tipo de entrada'), {
      target: { value: 't2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Cantidad'), {
      target: { value: '2' },
    });
    fireEvent.change(within(dialog).getByLabelText('Correo'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.change(within(dialog).getByLabelText('Nombre (opcional)'), {
      target: { value: 'Ana' },
    });
    fireEvent.change(within(dialog).getByLabelText('Pueden entrar hasta'), {
      target: { value: '2026-10-11T04:00:00.000Z' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(callsTo(PATH)).toHaveLength(1));
    expect(JSON.parse(callsTo(PATH)[0][1]?.body as string)).toEqual({
      ticketTypeId: 't2',
      quantity: 2,
      email: 'ana@example.com',
      name: 'Ana',
      validUntil: '2026-10-11T04:00:00.000Z',
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Mandamos el QR free a ana@example.com',
    );
    expect(
      await screen.findByRole('listitem', { name: /ana@example.com/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('si el servidor rechaza el envío, muestra el motivo y deja el formulario abierto', async () => {
    server({
      lists: [[]],
      action: Response.json(
        { message: 'Llegaste al límite de 30 envíos por hora.' },
        { status: 429 },
      ),
    });
    renderSection();
    await screen.findByText('Todavía no mandaste QR free.');

    fireEvent.click(screen.getByRole('button', { name: 'Enviar QR free' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Correo'), {
      target: { value: 'ana@example.com' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar' }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Llegaste al límite de 30 envíos por hora.',
      ),
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('anular pide confirmación y deja el envío anulado', async () => {
    server({
      lists: [[grant()], [grant({ status: 'CANCELLED' })]],
      action: Response.json(grant({ status: 'CANCELLED' })),
    });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Anular el envío a ana@example.com',
      }),
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Las entradas que todavía no se usaron dejan de servir',
    );
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Anular envío' }),
    );

    await waitFor(() => expect(callsTo(`${PATH}/g1/cancel`)).toHaveLength(1));
    const item = await screen.findByRole('listitem', {
      name: /ana@example.com/,
    });
    await waitFor(() => expect(item).toHaveTextContent('Anulado'));
  });

  it('reenviar manda el mail otra vez y lo avisa', async () => {
    server({ lists: [[grant()]] });
    renderSection();

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Reenviar a ana@example.com',
      }),
    );

    await waitFor(() => expect(callsTo(`${PATH}/g1/resend`)).toHaveLength(1));
    expect(toast.success).toHaveBeenCalledWith(
      'Reenviamos el mail a ana@example.com',
    );
  });

  it('un envío anulado no se puede reenviar ni anular', async () => {
    server({ lists: [[grant({ status: 'CANCELLED' })]] });
    renderSection();

    const item = await screen.findByRole('listitem', {
      name: /ana@example.com/,
    });
    expect(within(item).queryByRole('button')).not.toBeInTheDocument();
  });

  it('si no se pueden mandar QR free, lo explica en lugar del botón', async () => {
    server({ lists: [[grant()]] });

    renderSection('El evento terminó: ya no se pueden mandar QR free.');

    expect(
      await screen.findByText(
        'El evento terminó: ya no se pueden mandar QR free.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Enviar QR free' }),
    ).not.toBeInTheDocument();
  });
});
