import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TransactionsModal from './TransactionsModal';

const TRANSACTIONS = [
  {
    name: 'Ana Gómez',
    event: 'Fiesta de primavera',
    amount: 1000,
    time: '2026-09-26T12:00:00.000Z',
    status: 'PAID',
  },
  {
    name: 'Bruno Díaz',
    event: 'Recital acústico',
    amount: 2500,
    time: '2026-09-25T12:00:00.000Z',
    status: 'FAILED',
  },
];

describe('TransactionsModal', () => {
  it('filtra por comprador o por evento', () => {
    render(
      <TransactionsModal open onClose={() => {}} transactions={TRANSACTIONS} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Buscar/), {
      target: { value: 'recital' },
    });

    expect(screen.getByText('Bruno Díaz')).toBeInTheDocument();
    expect(screen.queryByText('Ana Gómez')).not.toBeInTheDocument();
  });

  it('muestra el monto y si el pago se aprobó', () => {
    render(
      <TransactionsModal open onClose={() => {}} transactions={TRANSACTIONS} />,
    );

    expect(screen.getByText('$2.500')).toBeInTheDocument();
    expect(screen.getByText('Aprobada')).toBeInTheDocument();
    expect(screen.getByText('Rechazada')).toBeInTheDocument();
  });

  it('sin transacciones muestra el aviso', () => {
    render(<TransactionsModal open onClose={() => {}} transactions={[]} />);

    expect(screen.getByText('Aún no hay transacciones.')).toBeInTheDocument();
  });

  it('se cierra con el botón de cerrar', () => {
    const onClose = vi.fn();
    render(
      <TransactionsModal open onClose={onClose} transactions={TRANSACTIONS} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));

    expect(onClose).toHaveBeenCalled();
  });
});
