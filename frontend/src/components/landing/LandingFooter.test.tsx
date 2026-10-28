import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import LandingFooter from './LandingFooter';

const signIn = (user: object) =>
  localStorage.setItem('user', JSON.stringify(user));

function renderFooter() {
  render(<LandingFooter />);
  return within(screen.getByRole('contentinfo'));
}

describe('Pie de la landing', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('sin sesión lleva a explorar eventos, a cómo funciona, a ingresar y a crear una cuenta', () => {
    const footer = renderFooter();

    expect(
      footer.getByRole('link', { name: 'Explorar eventos' }),
    ).toHaveAttribute('href', '/eventos');
    expect(footer.getByRole('link', { name: 'Cómo funciona' })).toHaveAttribute(
      'href',
      '#como-funciona',
    );
    expect(footer.getByRole('link', { name: 'Ingresar' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(footer.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
      'href',
      '/registro',
    );
    expect(
      footer.queryByRole('link', { name: 'Mis entradas' }),
    ).not.toBeInTheDocument();
  });

  it('con sesión de quien organiza muestra Mis entradas y Mi panel en lugar de ingresar', () => {
    signIn({ role: 'ORGANIZER' });
    const footer = renderFooter();

    expect(footer.getByRole('link', { name: 'Mis entradas' })).toHaveAttribute(
      'href',
      '/panel/tickets',
    );
    expect(footer.getByRole('link', { name: 'Mi panel' })).toHaveAttribute(
      'href',
      '/panel',
    );
    expect(
      footer.queryByRole('link', { name: 'Ingresar' }),
    ).not.toBeInTheDocument();
    expect(
      footer.queryByRole('link', { name: 'Crear cuenta' }),
    ).not.toBeInTheDocument();
  });

  it('con sesión de quien compra muestra Mis entradas, sin Mi panel', () => {
    signIn({ role: 'CUSTOMER' });
    const footer = renderFooter();

    expect(
      footer.getByRole('link', { name: 'Mis entradas' }),
    ).toBeInTheDocument();
    expect(
      footer.queryByRole('link', { name: 'Mi panel' }),
    ).not.toBeInTheDocument();
  });

  it('lleva al Instagram de NeoPass en otra pestaña', () => {
    const footer = renderFooter();

    const instagram = footer.getByRole('link', {
      name: 'NeoPass en Instagram',
    });
    expect(instagram).toHaveAttribute(
      'href',
      'https://www.instagram.com/neopass.ar/',
    );
    expect(instagram).toHaveAttribute('target', '_blank');
    expect(instagram).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('lleva a los textos legales, al botón de arrepentimiento y a Defensa del Consumidor', () => {
    const footer = renderFooter();

    for (const [name, href] of [
      ['Términos de uso', '/terminos'],
      ['Términos para organizadores', '/terminos/organizadores'],
      ['Política de privacidad', '/privacidad'],
    ]) {
      expect(footer.getByRole('link', { name })).toHaveAttribute('href', href);
    }
    expect(
      footer
        .getByRole('link', { name: 'Botón de arrepentimiento' })
        .getAttribute('href'),
    ).toMatch(
      /^mailto:soporte@neopass\.ar\?subject=Bot%C3%B3n%20de%20arrepentimiento/,
    );
    const consumerDefense = footer.getByRole('link', {
      name: 'Defensa de las y los Consumidores. Para reclamos ingrese aquí',
    });
    expect(consumerDefense).toHaveAttribute(
      'href',
      'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario',
    );
    expect(consumerDefense).toHaveAttribute('target', '_blank');
  });

  it('tiene el correo de soporte', () => {
    const footer = renderFooter();

    expect(
      footer.getByRole('link', { name: 'soporte@neopass.ar' }),
    ).toHaveAttribute('href', 'mailto:soporte@neopass.ar');
  });
});
