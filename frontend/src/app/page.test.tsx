import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import Home from './page';

function renderReasons() {
  render(<Home />);
  return screen.getByRole('region', { name: '¿Por qué elegir NeoPass?' });
}

describe('Landing', () => {
  it('cuenta en una frase qué ofrece a quien compra y a quien organiza', () => {
    render(<Home />);

    expect(
      screen.getByText(
        'Comprá tus entradas de forma rápida y segura. Organizá tus eventos desde un solo lugar, con control total y cobros directos en tu cuenta.',
      ),
    ).toBeInTheDocument();
  });

  it('explica por qué elegir NeoPass con cuatro razones: conexión y datos cifrados, facilidad de uso, orden y flexibilidad y cobro directo con Mercado Pago', () => {
    const reasons = within(renderReasons()).getAllByRole('article');

    expect(
      reasons.map((reason) => within(reason).getByRole('heading').textContent),
    ).toEqual([
      'Conexión y datos cifrados',
      'Facilidad de uso',
      'Orden y flexibilidad',
      'Cobro directo con Mercado Pago',
    ]);
  });

  it('ningún título de las razones lleva coma', () => {
    const titles = within(renderReasons()).getAllByRole('heading', {
      level: 3,
    });

    for (const title of titles) {
      expect(title.textContent).not.toContain(',');
    }
  });

  it('dice que las entradas llegan por correo sin nombrar el formato', () => {
    const { container } = render(<Home />);

    expect(
      screen.getByRole('article', { name: 'Facilidad de uso' }),
    ).toHaveTextContent('Te llegan por correo');
    expect(container).not.toHaveTextContent(/PDF/i);
  });

  it('la razón de orden habla de control total, de tandas y de staff sin hablar de plata', () => {
    render(<Home />);
    const order = screen.getByRole('article', { name: 'Orden y flexibilidad' });

    expect(order).toHaveTextContent('Control total');
    expect(order).toHaveTextContent('tandas');
    expect(order).toHaveTextContent('RPPs');
    expect(order).not.toHaveTextContent(/cobr|plata|dinero|pag|comisi|\$/i);
  });

  it('no promete lo que la app no hace: QR dinámico, alta demanda sin caídas ni el fin de la reventa', () => {
    render(<Home />);

    expect(
      screen.queryByText(/QR dinámico|sin caídas|reventa/),
    ).not.toBeInTheDocument();
  });
});
