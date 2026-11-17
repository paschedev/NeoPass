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

  it('los Términos para organizadores v2 explican el cargo del 10 % y el reparto de la comisión por mitades', () => {
    render(<TerminosOrganizadoresPage />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Términos para organizadores',
      }),
    ).toBeVisible();
    expect(
      screen.getByText('Versión 2 · vigente desde el 17 de noviembre de 2026'),
    ).toBeVisible();
    expect(
      screen.getByText(/El cargo de servicio es del 10 % sobre el precio/),
    ).toBeVisible();
    expect(
      screen.getByText(/se reparte por mitades entre el comprador y vos/),
    ).toBeVisible();
    expect(
      screen.getByText(/NeoPass recibe el cargo de servicio completo/),
    ).toBeVisible();
    expect(screen.queryByText(/tres partes/)).not.toBeInTheDocument();
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
