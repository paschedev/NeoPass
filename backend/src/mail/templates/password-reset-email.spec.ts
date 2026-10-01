import { passwordResetEmail } from './password-reset-email';

const RESET_LINK = 'https://neopass.test/reset-password?token=abc&from=mail';

function build(name = 'Ana') {
  return passwordResetEmail({ name, resetLink: RESET_LINK });
}

describe('Mail de recuperación de contraseña', () => {
  it('el asunto dice para qué es el mail', () => {
    expect(build().subject).toBe('Restablecé tu contraseña de NeoPass');
  });

  it('trae el botón y el mismo enlace como texto, por si el botón no funciona', () => {
    const { html } = build();
    const escapedLink = RESET_LINK.replace('&', '&amp;');

    expect(html).toContain('Restablecer mi contraseña');
    expect(html.split(`href="${escapedLink}"`)).toHaveLength(3);
    expect(html).toContain(`>${escapedLink}</a>`);
  });

  it('avisa que el enlace vence en 1 hora', () => {
    const { html, text } = build();

    expect(html).toContain('vence en 1 hora');
    expect(text).toContain('vence en 1 hora');
  });

  it('escapa el nombre de la persona', () => {
    const { html } = build('Ana <b>');

    expect(html).not.toContain('<b>');
    expect(html).toContain('Ana &lt;b&gt;');
  });

  it('la versión en texto plano trae el enlace sin escapar', () => {
    const { text } = build();

    expect(text).toContain(RESET_LINK);
    expect(text).not.toMatch(/<[a-z]/i);
  });

  it('lleva el encabezado de la marca y el contacto de soporte', () => {
    const { html, text } = build();

    expect(html).toContain('NeoPass');
    expect(html).toContain('mailto:soporte@neopass.ar');
    expect(text).toContain('soporte@neopass.ar');
  });
});
