import { SUPPORT_EMAIL } from '../mail-addresses';
import { escapeHtml } from '../escape-html';
import { layout, STYLES, TEXT_FOOTER } from './layout';

// Goes to the account's email when a Google account is linked to it.
export function googleLinkedEmail({ name }: { name: string }): {
  subject: string;
  html: string;
  text: string;
} {
  const linked =
    'Conectaste tu cuenta de Google a NeoPass. Desde ahora podés entrar con el botón "Continuar con Google".';
  const warning = `Si no fuiste vos, cambiá tu contraseña con "Olvidé mi contraseña" (eso desconecta Google) y escribinos a ${SUPPORT_EMAIL}`;

  const html = layout({
    preheader: escapeHtml(linked),
    content: `
      <h1 style="${STYLES.title}">Conectaste tu cuenta de Google</h1>
      <p style="${STYLES.paragraph}">Hola, ${escapeHtml(name)}. ${escapeHtml(linked)}</p>
      <p style="${STYLES.paragraph}">Si no fuiste vos, cambiá tu contraseña con "Olvidé mi contraseña" (eso desconecta Google) y escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="${STYLES.link}">${SUPPORT_EMAIL}</a>.</p>`,
  });

  const text = [`Hola, ${name}.`, linked, `${warning}.`, TEXT_FOOTER].join(
    '\n\n',
  );

  return { subject: 'Conectaste tu cuenta de Google a NeoPass', html, text };
}
