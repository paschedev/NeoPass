import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SalesChart from './SalesChart';

// Sábado 26/09/2026 al mediodía (los tests corren con TZ de Argentina).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-09-26T12:00:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

const SALES = [
  { date: '2026-09-25', revenue: 1500 },
  { date: '2026-09-19', revenue: 1000 },
];

describe('SalesChart', () => {
  it('muestra lo vendido en 7 días y cuánto cambió contra los 7 anteriores', () => {
    render(<SalesChart points={SALES} />);

    expect(screen.getByText('$1.500')).toBeInTheDocument();
    expect(
      screen.getByText(/50 % más que los 7 días anteriores/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('en 30 días suma todo el período y avisa si antes no hubo ventas', () => {
    render(<SalesChart points={SALES} />);

    fireEvent.click(screen.getByRole('button', { name: '30 días' }));

    expect(screen.getByText('$2.500')).toBeInTheDocument();
    expect(
      screen.getByText('Sin ventas en los 30 días anteriores'),
    ).toBeInTheDocument();
  });

  it('sin ventas en los 60 días muestra el anillo con el aviso', () => {
    render(<SalesChart points={[{ date: '2026-09-26', revenue: 0 }]} />);

    expect(
      screen.getByText('Sin ventas en los últimos 60 días'),
    ).toBeInTheDocument();
  });

  it('mientras cargan los datos no afirma que no hay ventas', () => {
    render(<SalesChart points={[]} />);

    expect(
      screen.queryByText('Sin ventas en los últimos 60 días'),
    ).not.toBeInTheDocument();
  });
});
