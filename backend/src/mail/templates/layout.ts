import { escapeHtml } from '../escape-html';
import { SUPPORT_EMAIL } from '../mail-addresses';

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const ACCENT = '#4f46e5';

// Mail clients only honor inline styles: these are shared by the templates.
export const STYLES = {
  title:
    'margin: 0 0 12px; font-size: 22px; line-height: 28px; color: #18181b;',
  paragraph:
    'margin: 0 0 16px; font-size: 15px; line-height: 22px; color: #3f3f46;',
  note: 'margin: 0 0 12px; font-size: 13px; line-height: 19px; color: #71717a;',
  link: `color: ${ACCENT};`,
};

// Text wordmark until the official logo exists. Replace it with an <img> of a
// PNG on a public URL: Gmail renders neither SVG nor `data:` images.
const BRAND =
  '<span style="font-size: 20px; font-weight: 700; letter-spacing: 0.5px; color: #ffffff;">NeoPass</span>';

// `preheader` and `content` are HTML: escape user text before passing it in.
export function layout({
  preheader,
  content,
}: {
  preheader: string;
  content: string;
}): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>NeoPass</title>
</head>
<body style="margin: 0; padding: 0; background: #f4f4f5;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background: #ffffff; border-radius: 16px; overflow: hidden; font-family: ${FONT};">
          <tr>
            <td align="center" style="padding: 20px 32px; background: #0a0a0a;">${BRAND}</td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 20px;">${content}</td>
          </tr>
          <tr>
            <td align="center" style="padding: 20px 32px; border-top: 1px solid #e4e4e7; font-size: 12px; line-height: 18px; color: #71717a;">
              ¿Necesitás ayuda? Escribinos a <a href="mailto:${SUPPORT_EMAIL}" style="${STYLES.link}">${SUPPORT_EMAIL}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function button(label: string, href: string): string {
  return `<table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin: 24px auto;">
    <tr>
      <td style="border-radius: 999px; background: ${ACCENT};">
        <a href="${escapeHtml(href)}" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;
}

export const TEXT_FOOTER = `NeoPass · ¿Necesitás ayuda? Escribinos a ${SUPPORT_EMAIL}`;
