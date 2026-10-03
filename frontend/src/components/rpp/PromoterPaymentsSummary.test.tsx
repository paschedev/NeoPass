import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import PromoterPaymentsSummary from './PromoterPaymentsSummary';

describe('PromoterPaymentsSummary', () => {
  it('muestra lo que le pagaron, lo que le deben y cada pago', () => {
    render(
      <PromoterPaymentsSummary
        totalPaid={150}
        balance={50}
        payments={[
          {
            amount: 150,
            note: 'Efectivo',
            createdAt: '2026-10-02T15:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('Te pagaron')).toBeInTheDocument();
    expect(screen.getByText('$150', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('Te deben')).toBeInTheDocument();
    expect(screen.getByText('$50')).toBeInTheDocument();
    const history = screen.getByRole('list', { name: 'Pagos recibidos' });
    expect(within(history).getByText(/Efectivo/)).toBeInTheDocument();
    expect(within(history).getByText(/2 oct/)).toBeInTheDocument();
  });

  it('sin pagos todavía lo dice', () => {
    render(
      <PromoterPaymentsSummary totalPaid={0} balance={200} payments={[]} />,
    );

    expect(
      screen.getByText('Todavía no registraron pagos.'),
    ).toBeInTheDocument();
  });
});
