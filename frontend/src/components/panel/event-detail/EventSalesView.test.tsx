import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { EventSales } from './types';
import EventSalesView from './EventSalesView';

const HOUR_MS = 60 * 60 * 1000;
const now = new Date('2026-10-01T20:00:00Z');
const at = (hours: number) =>
  new Date(now.getTime() + hours * HOUR_MS).toISOString();

const sales = (overrides: Partial<EventSales['event']> = {}): EventSales => ({
  event: {
    id: 'event-1',
    title: 'Fiesta de primavera',
    status: 'PUBLISHED',
    startDate: at(24),
    endDate: at(30),
    venueName: 'Club Central',
    venueAddress: 'Av. Corrientes 1234',
    ...overrides,
  },
  totals: {
    revenue: 4000,
    sold: 3,
    reserved: 1,
    capacity: 150,
    checkedIn: 1,
    refundedOrders: 2,
  },
  batches: [
    {
      id: 'b1',
      name: 'Preventa',
      saleStatus: 'ON_SALE',
      ticketTypes: [
        {
          id: 't1',
          name: 'General',
          price: 1000,
          stock: 100,
          sold: 2,
          reserved: 1,
          available: 97,
          revenue: 2000,
        },
      ],
    },
    {
      id: 'b2',
      name: 'General',
      saleStatus: 'SOLD_OUT',
      ticketTypes: [
        {
          id: 't2',
          name: 'Campo',
          price: 2000,
          stock: 1,
          sold: 1,
          reserved: 0,
          available: 0,
          revenue: 2000,
        },
      ],
    },
  ],
});

describe('EventSalesView', () => {
  afterEach(() => vi.useRealTimers());

  const renderView = (data: EventSales) => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    render(<EventSalesView sales={data} />);
  };

  it('muestra el resumen: lo recaudado, las vendidas sobre el total, los ingresos y las devoluciones', () => {
    renderView(sales());

    const summary = screen.getByRole('region', { name: 'Resumen' });
    expect(within(summary).getByText('$4.000')).toBeInTheDocument();
    expect(
      within(summary).getByText(/Mercado Pago descuenta su comisión/),
    ).toBeInTheDocument();
    expect(within(summary).getByText('3 de 150')).toBeInTheDocument();
    expect(
      within(summary).getByText('1 en proceso de pago'),
    ).toBeInTheDocument();
    expect(within(summary).getByText('1 de 3')).toBeInTheDocument();
    expect(within(summary).getByText('2')).toBeInTheDocument();
  });

  it('muestra cada tanda con su estado y, por tipo de entrada, precio, vendidas, disponibles y recaudado', () => {
    renderView(sales());

    const preventa = screen.getByRole('region', { name: 'Tanda Preventa' });
    expect(within(preventa).getByText('A la venta')).toBeInTheDocument();
    const row = within(preventa).getByRole('row', { name: /General/ });
    expect(row).toHaveTextContent('$1.000');
    expect(row).toHaveTextContent('2');
    expect(row).toHaveTextContent('97');
    expect(row).toHaveTextContent('$2.000');
    expect(
      within(screen.getByRole('region', { name: 'Tanda General' })).getByText(
        'Agotada',
      ),
    ).toBeInTheDocument();
  });

  it('un evento publicado ofrece editarlo y abrir su página pública', () => {
    renderView(sales());

    expect(screen.getByRole('link', { name: 'Editar evento' })).toHaveAttribute(
      'href',
      '/panel/eventos/event-1/editar',
    );
    expect(
      screen.getByRole('link', { name: /ver página pública/i }),
    ).toHaveAttribute('href', '/eventos/event-1');
  });

  it('un evento en borrador no tiene página pública', () => {
    renderView(sales({ status: 'DRAFT' }));

    expect(
      screen.queryByRole('link', { name: /ver página pública/i }),
    ).not.toBeInTheDocument();
  });

  it('un evento finalizado no se edita ni tiene página pública, pero muestra sus ventas', () => {
    renderView(
      sales({ status: 'FINISHED', startDate: at(-30), endDate: at(-24) }),
    );

    expect(screen.getByText('Evento finalizado')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Editar evento' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /ver página pública/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Resumen' })).toBeInTheDocument();
  });

  it('un evento sin tandas lo dice', () => {
    renderView({ ...sales(), batches: [] });

    expect(
      screen.getByText('Este evento todavía no tiene tandas.'),
    ).toBeInTheDocument();
  });
});
