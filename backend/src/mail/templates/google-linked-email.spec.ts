import { googleLinkedEmail } from './google-linked-email';

describe('Mail que avisa que se conectó una cuenta de Google', () => {
  it('el asunto dice qué pasó', () => {
    expect(googleLinkedEmail({ name: 'Ana' }).subject).toBe(
      'Conectaste tu cuenta de Google a NeoPass',
    );
  });

  it('dice qué hacer si no fue la persona', () => {
    const { html, text } = googleLinkedEmail({ name: 'Ana' });

    expect(text).toContain('Olvidé mi contraseña');
    expect(text).toContain('soporte@neopass.ar');
    expect(html).toContain('mailto:soporte@neopass.ar');
  });

  it('escapa el nombre de la persona', () => {
    const { html } = googleLinkedEmail({ name: 'Ana <b>' });

    expect(html).not.toContain('<b>');
    expect(html).toContain('Ana &lt;b&gt;');
  });
});
