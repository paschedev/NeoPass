import { EmailCodePurpose } from '@prisma/client';
import { escapeHtml } from '../escape-html';
import { layout, STYLES, TEXT_FOOTER } from './layout';

const COPY: Record<EmailCodePurpose, { title: string; intro: string }> = {
  VERIFY: {
    title: 'Confirmá tu correo',
    intro: 'Escribí este código en NeoPass para confirmar tu correo:',
  },
  CHANGE: {
    title: 'Confirmá tu nuevo correo',
    intro:
      'Escribí este código en NeoPass para que tu cuenta de NeoPass pase a usar este correo:',
  },
};

const CODE_STYLE =
  'margin: 8px 0 24px; font-size: 34px; line-height: 40px; font-weight: 700; letter-spacing: 8px; text-align: center; color: #18181b;';

export function emailCodeEmail({
  name,
  code,
  purpose,
}: {
  name: string;
  code: string;
  purpose: EmailCodePurpose;
}): { subject: string; html: string; text: string } {
  const { title, intro } = COPY[purpose];
  const expiry =
    'El código vence en 15 minutos. Si no fuiste vos, ignorá este mail: tu cuenta no cambia.';

  const html = layout({
    preheader: escapeHtml(`${code} es tu código de NeoPass`),
    content: `
      <h1 style="${STYLES.title}">${escapeHtml(title)}</h1>
      <p style="${STYLES.paragraph}">Hola, ${escapeHtml(name)}. ${escapeHtml(intro)}</p>
      <p style="${CODE_STYLE}">${escapeHtml(code)}</p>
      <p style="${STYLES.note}">${escapeHtml(expiry)}</p>`,
  });

  const text = [
    `Hola, ${name}.`,
    `${intro}\n\n${code}`,
    expiry,
    TEXT_FOOTER,
  ].join('\n\n');

  return { subject: `${code} es tu código de NeoPass`, html, text };
}
