import { SUPPORT_EMAIL } from '../mail-addresses';
import { escapeHtml } from '../escape-html';
import { layout, STYLES, TEXT_FOOTER } from './layout';

// Goes to the old email: `newEmail` arrives masked.
export function emailChangedEmail({
  name,
  newEmail,
}: {
  name: string;
  newEmail: string;
}): { subject: string; html: string; text: string } {
  const change = `El correo de tu cuenta de NeoPass ahora es ${newEmail}. Desde ahora, tus entradas y los mails de la cuenta van a ese correo.`;
  const warning = `Si no fuiste vos, escribinos a ${SUPPORT_EMAIL}`;

  const html = layout({
    preheader: escapeHtml(change),
    content: `
      <h1 style="${STYLES.title}">Cambió el correo de tu cuenta</h1>
      <p style="${STYLES.paragraph}">Hola, ${escapeHtml(name)}. ${escapeHtml(change)}</p>
      <p style="${STYLES.paragraph}">Si no fuiste vos, escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="${STYLES.link}">${SUPPORT_EMAIL}</a>.</p>`,
  });

  const text = [`Hola, ${name}.`, change, `${warning}.`, TEXT_FOOTER].join(
    '\n\n',
  );

  return { subject: 'Cambió el correo de tu cuenta de NeoPass', html, text };
}
