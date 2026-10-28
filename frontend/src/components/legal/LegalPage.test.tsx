import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TerminosPage from '@/app/terminos/page';
import TerminosOrganizadoresPage from '@/app/terminos/organizadores/page';
import PrivacidadPage from '@/app/privacidad/page';

const VERSION = 'Versión 1 · vigente desde el 28 de octubre de 2026';

describe('Textos legales', () => {
  it('los Términos de uso muestran su versión y llevan a la Política de privacidad', () => {
    render(<TerminosPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Términos de uso' }),
    ).toBeVisible();
    expect(screen.getByText(VERSION)).toBeVisible();
    expect(
      screen.getByRole('heading', { name: '9. Botón de arrepentimiento' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Política de privacidad' }),
    ).toHaveAttribute('href', '/privacidad');
  });

  it('los Términos para organizadores explican el cargo del 12 % y el reparto de la comisión', () => {
    render(<TerminosOrganizadoresPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Términos para organizadores',
      }),
    ).toBeVisible();
    expect(screen.getByText(VERSION)).toBeVisible();
    expect(
      screen.getByText(/El cargo de servicio es del 12 % sobre el precio/),
    ).toBeVisible();
    expect(
      screen.getByText(/se descuenta de tus ventas siguientes, hasta el 10 %/),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Términos de uso' }),
    ).toHaveAttribute('href', '/terminos');
  });

  it('la Política de privacidad lista los proveedores y las leyendas de la ley de datos', () => {
    render(<PrivacidadPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Política de privacidad' }),
    ).toBeVisible();
    expect(screen.getByText(VERSION)).toBeVisible();
    const neon = screen.getByRole('row', { name: /Neon/ });
    expect(within(neon).getByText('EE. UU.')).toBeVisible();
    expect(
      screen.getByText(/AGENCIA DE ACCESO A LA INFORMACIÓN PÚBLICA/),
    ).toBeVisible();
    expect(screen.queryByText(/\[NÚMERO\]/)).not.toBeInTheDocument();
  });
});
