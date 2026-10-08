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

describe('InviteStaffModal', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('invita a un co-organizador con los permisos marcados y su tope de QR free', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      String(path).startsWith('/auth/users/search')
        ? Response.json([ANA])
        : Response.json({ id: 'staff-1' }),
    );
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
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(onInvited).toHaveBeenCalled());
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === '/events/e1/staff')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      userId: 'u1',
      role: 'MANAGER',
      permissions: ['VIEW_SALES', 'SEND_FREE_TICKETS', 'MANAGE_STAFF'],
      freeTicketLimit: 20,
    });
  });

  it('el dueño invita a un RPP que puede mandar QR free hasta una cantidad máxima', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path) =>
      String(path).startsWith('/auth/users/search')
        ? Response.json([ANA])
        : Response.json({ id: 'staff-1' }),
    );
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
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /Ana Pérez/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(onInvited).toHaveBeenCalled());
    const [, init] = vi
      .mocked(apiFetch)
      .mock.calls.find(([path]) => path === '/events/e1/staff')!;
    expect(JSON.parse(String(init?.body))).toEqual({
      userId: 'u1',
      role: 'PROMOTER',
      commissionType: 'PERCENTAGE',
      commissionValue: 10,
      freeTicketLimit: 10,
    });
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
