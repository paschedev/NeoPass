import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Landing', () => {
  it('cuenta en una frase qué ofrece a quien compra y a quien organiza', () => {
    render(<Home />);

    expect(
      screen.getByText(
        'Comprá tus entradas de forma rápida y segura. Organizá tus eventos desde un solo lugar, con control total y cobros directos en tu cuenta.',
      ),
    ).toBeInTheDocument();
  });

  it('explica por qué elegir NeoPass: datos seguros, registro y compra fáciles y control para organizadores', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: 'Tus datos, seguros' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Registrarte y comprar es fácil' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Control total para organizadores' }),
    ).toBeInTheDocument();
  });

  it('no promete lo que la app no hace: QR dinámico, alta demanda sin caídas ni el fin de la reventa', () => {
    render(<Home />);

    expect(
      screen.queryByText(/QR dinámico|sin caídas|reventa/),
    ).not.toBeInTheDocument();
  });
});
