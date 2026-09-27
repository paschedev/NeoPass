import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import Modal from './Modal';

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  });

  it('cerrado no muestra nada', () => {
    render(
      <Modal open={false} onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abierto muestra el contenido como un diálogo', () => {
    render(
      <Modal open onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveTextContent('Contenido');
  });

  it('se cierra con Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un click en el fondo lo cierra y un click adentro no', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Contenido</p>
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByText('Contenido'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mientras está abierto la página de atrás no scrollea', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <Modal open={false} onClose={() => {}}>
        <p>Contenido</p>
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
  });
});
