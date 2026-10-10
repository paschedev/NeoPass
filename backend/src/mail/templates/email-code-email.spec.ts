import { emailCodeEmail } from './email-code-email';

function build(purpose: 'VERIFY' | 'CHANGE' = 'VERIFY', name = 'Ana') {
  return emailCodeEmail({ name, code: '048213', purpose });
}

describe('Mail del código para confirmar el correo', () => {
  it('el asunto trae el código, para verlo sin abrir el mail', () => {
    expect(build().subject).toBe('048213 es tu código de NeoPass');
  });

  it('muestra el código y cuándo vence, en HTML y en texto plano', () => {
    const { html, text } = build();

    expect(html).toContain('048213');
    expect(text).toContain('048213');
    expect(html).toContain('vence en 15 minutos');
    expect(text).toContain('vence en 15 minutos');
  });

  it('dice para qué es: confirmar el correo o pasar la cuenta a este correo', () => {
    expect(build('VERIFY').html).toContain('Confirmá tu correo');
    expect(build('CHANGE').html).toContain('Confirmá tu nuevo correo');
    expect(build('CHANGE').text).toContain(
      'tu cuenta de NeoPass pase a usar este correo',
    );
  });

  it('escapa el nombre de la persona', () => {
    const { html } = build('VERIFY', 'Ana <b>');

    expect(html).not.toContain('<b>');
    expect(html).toContain('Ana &lt;b&gt;');
  });

  it('la versión en texto plano no trae HTML y sí el contacto de soporte', () => {
    const { text } = build();

    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain('soporte@neopass.ar');
  });
});
