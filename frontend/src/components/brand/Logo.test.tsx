import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Isologo from './Isologo';
import Logo from './Logo';

describe('Logo', () => {
  it('se lee como NeoPass', () => {
    render(<Logo />);
    expect(screen.getByRole('img', { name: 'NeoPass' })).toBeInTheDocument();
  });

  // Dos logos en la misma página (la barra en PC y en el celular) no pueden
  // compartir el id del degradado: si el primero está oculto, el otro se
  // quedaría sin color.
  it('cada logo usa sus propios degradados', () => {
    const { container } = render(
      <>
        <Logo />
        <Logo />
      </>,
    );
    const ids = [...container.querySelectorAll('linearGradient')].map(
      (gradient) => gradient.id,
    );
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});

describe('Isologo', () => {
  it('es decorativa salvo que se le dé un nombre', () => {
    const { rerender } = render(<Isologo />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    rerender(<Isologo label="NeoPass" />);
    expect(screen.getByRole('img', { name: 'NeoPass' })).toBeInTheDocument();
  });
});
