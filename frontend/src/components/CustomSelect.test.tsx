import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomSelect from './CustomSelect';

const OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'vip', label: 'VIP' },
];

describe('CustomSelect', () => {
  it('muestra el placeholder cuando no hay nada elegido', () => {
    render(
      <CustomSelect
        value=""
        onChange={() => {}}
        options={OPTIONS}
        placeholder="Elegí una entrada"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Elegí una entrada' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'VIP' }),
    ).not.toBeInTheDocument();
  });

  it('al elegir una opción avisa el valor y cierra la lista', () => {
    const onChange = vi.fn();
    render(
      <CustomSelect
        value=""
        onChange={onChange}
        options={OPTIONS}
        placeholder="Elegí una entrada"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Elegí una entrada' }));
    fireEvent.click(screen.getByRole('button', { name: 'VIP' }));

    expect(onChange).toHaveBeenCalledWith('vip');
    expect(
      screen.queryByRole('button', { name: 'VIP' }),
    ).not.toBeInTheDocument();
  });

  it('se cierra al hacer click afuera', () => {
    render(
      <div>
        <p>Afuera</p>
        <CustomSelect value="general" onChange={() => {}} options={OPTIONS} />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'General' }));
    expect(screen.getByRole('button', { name: 'VIP' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('Afuera'));

    expect(
      screen.queryByRole('button', { name: 'VIP' }),
    ).not.toBeInTheDocument();
  });
});
