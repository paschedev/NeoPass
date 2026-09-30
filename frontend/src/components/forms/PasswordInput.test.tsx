import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('arranca oculta y el ojo la muestra y la vuelve a ocultar', () => {
    render(
      <>
        <label htmlFor="password">Contraseña</label>
        <PasswordInput id="password" />
      </>,
    );
    const input = screen.getByLabelText('Contraseña');

    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('tocar el ojo no envía el formulario', () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="Contraseña" />
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('le pasa al campo el nombre, el valor y los cambios', () => {
    const onChange = vi.fn();
    render(
      <PasswordInput
        aria-label="Contraseña"
        name="password"
        value="secreta1"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Contraseña');

    fireEvent.change(input, { target: { value: 'secreta12' } });

    expect(input).toHaveAttribute('name', 'password');
    expect(input).toHaveValue('secreta1');
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
