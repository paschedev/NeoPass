import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TicketModal from './TicketModal';
import type { MyTicket } from './types';

vi.mock('@/hooks/useUserSearch', () => ({
  useUserSearch: (term: string) =>
    term.length >= 3
      ? [{ id: 'u2', name: 'Bruno Díaz', email: 'b***@neopass.test' }]
      : [],
}));

const TICKET: MyTicket = {
  id: 'ticket-0001',
  status: 'VALID',
  qrCode: 'abcd1234-qr',
  ticketType: {
    name: 'General',
    event: {
      title: 'Fiesta de primavera',
      startDate: '2026-10-03T23:00:00.000Z',
      venueName: 'Club Central',
    },
  },
};

const renderModal = (
  ticket: MyTicket = TICKET,
  onTransfer = vi.fn().mockResolvedValue(true),
) => {
  render(
    <TicketModal
      ticket={ticket}
      onClose={() => {}}
      onTransfer={onTransfer}
      transferring={false}
    />,
  );
  return onTransfer;
};

describe('TicketModal', () => {
  it('el QR arranca oculto y se revela al tocarlo', () => {
    renderModal();

    fireEvent.click(screen.getByText('Tocá para revelar'));

    expect(screen.queryByText('Tocá para revelar')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Ocultar QR' }),
    ).toBeInTheDocument();
  });

  it('una entrada anulada por una devolución no muestra el QR ni se puede transferir', () => {
    renderModal({ ...TICKET, status: 'REFUNDED' });

    expect(screen.getByText(/Entrada anulada/)).toBeInTheDocument();
    expect(screen.queryByText('Tocá para revelar')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Transferir/ }),
    ).not.toBeInTheDocument();
  });

  it('una entrada usada no se puede transferir', () => {
    renderModal({ ...TICKET, status: 'USED' });

    expect(
      screen.queryByRole('button', { name: /Transferir/ }),
    ).not.toBeInTheDocument();
  });

  it('transfiere al usuario elegido en la búsqueda', () => {
    const onTransfer = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Transferir/ }));
    fireEvent.change(screen.getByPlaceholderText(/Buscar usuario/), {
      target: { value: 'bru' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Bruno Díaz/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(onTransfer).toHaveBeenCalledWith(
      TICKET,
      expect.objectContaining({ id: 'u2' }),
    );
  });

  it('sin destinatario elegido no se puede confirmar', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Transferir/ }));

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
  });

  it('cancelar vuelve a mostrar el botón de transferir', () => {
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: /Transferir/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(
      screen.getByRole('button', { name: /Transferir/ }),
    ).toBeInTheDocument();
  });
});
