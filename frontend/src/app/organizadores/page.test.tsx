import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import OrganizadoresPage from './page';

describe('Página para organizadores', () => {
  it('cuenta lo que nos diferencia, cómo cobrás y qué hace NeoPass por vos', () => {
    render(<OrganizadoresPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Tu evento en orden de punta a punta',
      }),
    ).toBeVisible();
    for (const title of [
      'Lo que nos diferencia',
      'Cómo cobrás',
      'Tus ventas en vivo',
      'Tus RRPP bajo control',
      'Tu equipo con permisos',
      'La puerta bajo control',
      'Empezá hoy',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeVisible();
    }
    expect(
      screen.getByText(
        'Sin abono ni costo de alta. El cargo de servicio lo paga quien compra.',
      ),
    ).toBeVisible();
  });

  it('invita a crear la cuenta y a escribir por WhatsApp', () => {
    render(<OrganizadoresPage />);

    for (const link of screen.getAllByRole('link', { name: 'Crear cuenta' })) {
      expect(link).toHaveAttribute('href', '/registro');
    }
    for (const link of screen.getAllByRole('link', {
      name: 'Escribinos por WhatsApp',
    })) {
      expect(link).toHaveAttribute('href', 'https://wa.me/5493534224528');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});
