import { emailChangedEmail } from './email-changed-email';

function build(name = 'Ana') {
  return emailChangedEmail({ name, newEmail: 'n***o@neopass.test' });
}

describe('Mail que avisa al correo viejo que la cuenta cambió de correo', () => {
  it('el asunto dice qué pasó', () => {
    expect(build().subject).toBe('Cambió el correo de tu cuenta de NeoPass');
  });

  it('muestra el correo nuevo enmascarado y qué hacer si no fue la persona', () => {
    const { html, text } = build();

    expect(html).toContain('n***o@neopass.test');
    expect(text).toContain('n***o@neopass.test');
    expect(text).toContain('Si no fuiste vos, escribinos a soporte@neopass.ar');
  });

  it('escapa el nombre de la persona', () => {
    const { html } = build('Ana <b>');

    expect(html).not.toContain('<b>');
    expect(html).toContain('Ana &lt;b&gt;');
  });
});
