import { escapeHtml } from '../escape-html';
import { button, layout, STYLES, TEXT_FOOTER } from './layout';

export function passwordResetEmail({
  name,
  resetLink,
}: {
  name: string;
  resetLink: string;
}): { subject: string; html: string; text: string } {
  const intro = 'Pediste cambiar tu contraseña de NeoPass.';
  const expiry =
    'El enlace vence en 1 hora. Si no fuiste vos, ignorá este mail: tu contraseña sigue siendo la misma.';
  const link = escapeHtml(resetLink);

  const html = layout({
    preheader: escapeHtml(intro),
    content: `
      <h1 style="${STYLES.title}">Restablecé tu contraseña</h1>
      <p style="${STYLES.paragraph}">Hola, ${escapeHtml(name)}. ${escapeHtml(intro)} Tocá el botón para crear una nueva:</p>
      ${button('Restablecer mi contraseña', resetLink)}
      <p style="${STYLES.note}">Si el botón no funciona, copiá este enlace en tu navegador:<br><a href="${link}" style="${STYLES.link} word-break: break-all;">${link}</a></p>
      <p style="${STYLES.note}">${escapeHtml(expiry)}</p>`,
  });

  const text = [
    `Hola, ${name}.`,
    `${intro} Entrá a este enlace para crear una nueva:\n${resetLink}`,
    expiry,
    TEXT_FOOTER,
  ].join('\n\n');

  return { subject: 'Restablecé tu contraseña de NeoPass', html, text };
}
