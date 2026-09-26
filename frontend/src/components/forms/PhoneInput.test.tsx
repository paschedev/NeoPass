import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PhoneInput from './PhoneInput';

const renderInput = () => {
  const props = {
    prefix: '+54',
    onPrefixChange: vi.fn(),
    value: '',
    onChange: vi.fn(),
    onBlur: vi.fn(),
    invalid: false,
  };
  render(<PhoneInput {...props} />);
  return props;
};

describe('PhoneInput', () => {
  it('muestra el prefijo elegido y deja cambiar de país', () => {
    const { onPrefixChange } = renderInput();

    fireEvent.click(screen.getByRole('button', { name: /\+54/ }));
    fireEvent.click(screen.getByRole('button', { name: /UY/ }));

    expect(onPrefixChange).toHaveBeenCalledWith('+598');
    expect(screen.queryByRole('button', { name: /UY/ })).toBeNull();
  });

  it('formatea el número mientras se escribe', () => {
    const { onChange } = renderInput();

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '1123456789' },
    });

    expect(onChange).toHaveBeenCalledWith('11 2345-6789');
  });

  it('la lista de países se cierra con un click afuera', () => {
    renderInput();

    fireEvent.click(screen.getByRole('button', { name: /\+54/ }));
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole('button', { name: /UY/ })).toBeNull();
  });
});
