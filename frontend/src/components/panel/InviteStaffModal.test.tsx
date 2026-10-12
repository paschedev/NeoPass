import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { apiFetch } from '@/utils/api';
import toast from '@/utils/toast';
import InviteStaffModal from './InviteStaffModal';

vi.mock('@/utils/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/utils/toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const ANA = { id: 'u1', name: 'Ana Pérez', email: 'ana@example.com' };

// GET /events/organizer/e1: General en dos tandas y VIP en una.
const EVENT = {
  id: 'e1',
  ticketBatches: [
    {
      name: 'Preventa',
      ticketTypes: [
        { id: 't1', name: 'General' },
        { id: 't2', name: 'VIP' },
      ],
    },
    { name: 'Lote 1', ticketTypes: [{ id: 't3', name: 'General' }] },
  ],
};

function mockApi() {
  vi.mocked(apiFetch).mockImplementation(async (path) => {
    const url = String(path);
    if (url.startsWith('/auth/users/search')) return Response.json([ANA]);
    if (url === '/events/organizer/e1') return Response.json(EVENT);
    return Response.json({ id: 'staff-1' });
  });
}

async function pickAna() {
  fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
    target: { value: 'Ana' },
  });
  fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
}

const invitationBody = () => {
  const [, init] = vi
    .mocked(apiFetch)
    .mock.calls.find(([path]) => path === '/events/e1/staff')!;
  return JSON.parse(String(init?.body)) as unknown;
};

describe('InviteStaffModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('invita a un co-organizador con los permisos marcados, su tope y los tipos que puede regalar', async () => {
    mockApi();
    const onInvited = vi.fn();
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        initialEventId="e1"
        onInvited={onInvited}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Co-organizador' }));
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Staff y pagos a RPPs/ }),
    );
    expect(
      screen.getByRole('checkbox', { name: /Ver ventas y recaudación/ }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /QR free/ }));
    fireEvent.change(screen.getByLabelText(/Tope de QR free/), {
      target: { value: '20' },
    });
    fireEvent.click(await screen.findByRole('checkbox', { name: 'VIP' }));
    await pickAna();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(onInvited).toHaveBeenCalled());
    expect(invitationBody()).toEqual({
      userId: 'u1',
      role: 'MANAGER',
      permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS', 'MANAGE_STAFF'],
      freeTicketLimit: 20,
      freeTicketTypes: ['VIP'],
    });
  });

  it('el dueño invita a un RPP que puede mandar QR free hasta una cantidad máxima, de los tipos que tilde', async () => {
    mockApi();
    const onInvited = vi.fn();
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        initialEventId="e1"
        initialRole="RPP"
        canGrantFreeTickets
        onInvited={onInvited}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Ej: 15.0'), {
      target: { value: '10' },
    });
    expect(screen.queryByLabelText('Cantidad máxima')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Puede mandar QR free/ }),
    );
    fireEvent.change(screen.getByLabelText('Cantidad máxima'), {
      target: { value: '10' },
    });
    // Cada nombre aparece una vez aunque esté en varias tandas, sin tildar.
    expect(
      await screen.findByRole('checkbox', { name: 'General' }),
    ).not.toBeChecked();
    expect(screen.getAllByRole('checkbox', { name: 'General' })).toHaveLength(
      1,
    );
    expect(screen.getByRole('checkbox', { name: 'VIP' })).not.toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'General' }));
    await pickAna();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(onInvited).toHaveBeenCalled());
    expect(invitationBody()).toEqual({
      userId: 'u1',
      role: 'PROMOTER',
      commissionType: 'PERCENTAGE',
      commissionValue: 10,
      freeTicketLimit: 10,
      freeTicketTypes: ['General'],
    });
  });

  it('con QR free y sin tipos tildados, avisa y no invita', async () => {
    mockApi();
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        initialEventId="e1"
        initialRole="RPP"
        canGrantFreeTickets
        onInvited={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Ej: 15.0'), {
      target: { value: '10' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Puede mandar QR free/ }),
    );
    fireEvent.change(screen.getByLabelText('Cantidad máxima'), {
      target: { value: '10' },
    });
    await screen.findByRole('checkbox', { name: 'General' });
    await pickAna();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(toast.error).toHaveBeenCalledWith(
      'Elegí al menos un tipo de entrada para los QR free',
    );
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([path]) => path === '/events/e1/staff'),
    ).toBe(false);
  });

  it('con QR free marcado y sin cantidad, avisa y no invita', async () => {
    vi.mocked(apiFetch).mockImplementation(async () => Response.json([ANA]));
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        initialEventId="e1"
        initialRole="RPP"
        canGrantFreeTickets
        onInvited={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Ej: 15.0'), {
      target: { value: '10' },
    });
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Puede mandar QR free/ }),
    );
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(toast.error).toHaveBeenCalledWith(
      'Indicá cuántos QR free puede mandar',
    );
    expect(
      vi
        .mocked(apiFetch)
        .mock.calls.some(([path]) => path === '/events/e1/staff'),
    ).toBe(false);
  });

  it('quien no es el dueño no puede habilitar QR free a un RPP', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        initialRole="RPP"
        allowCoOrganizer={false}
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('checkbox', { name: /Puede mandar QR free/ }),
    ).not.toBeInTheDocument();
  });

  it('sin poder invitar co-organizadores, ese rol no aparece', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        allowCoOrganizer={false}
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Co-organizador' }),
    ).not.toBeInTheDocument();
  });

  it('el rol se elige entre Scanner y Promotor', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        onInvited={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Scanner' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Promotor' }),
    ).toBeInTheDocument();
  });

  it('sin evento elegido arranca vacío y con Scanner', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[{ id: 'e1', title: 'Fiesta de prueba' }]}
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Elegir un evento...' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scanner' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('abierto desde un evento, llega con ese evento y el rol ya elegidos', () => {
    render(
      <InviteStaffModal
        open
        onClose={vi.fn()}
        events={[
          { id: 'e1', title: 'Fiesta de prueba' },
          { id: 'e2', title: 'Techno Sunset' },
        ]}
        initialEventId="e2"
        initialRole="RPP"
        onInvited={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Techno Sunset' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Promotor' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
