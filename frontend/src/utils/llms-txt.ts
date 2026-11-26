import { FAQ_SECTIONS } from './faq';
import { EVENT_TIME_ZONE, formatWeekdayDateTime } from './format';
import { LEGAL_DOCUMENTS } from './legal';
import { fetchPublicEventsPage } from './public-events';
import {
  INSTAGRAM_URL,
  SITE_DESCRIPTION,
  SITE_URL,
  eventPath,
} from './site';
import { SUPPORT_EMAIL } from './support';

// El máximo por página que acepta GET /events: alcanza para la guía.
const MAX_EVENTS = 50;

// /llms.txt: una guía en texto para los buscadores con IA (ChatGPT,
// Perplexity, Claude, Gemini), que en general no ejecutan JavaScript. Dice
// qué es NeoPass, sus páginas clave, los próximos eventos y las preguntas
// frecuentes. Formato de https://llmstxt.org.
export async function buildLlmsTxt(revalidate: number): Promise<string> {
  const events = await fetchPublicEventsPage(1, MAX_EVENTS, revalidate);

  const pages = [
    ['Eventos', '/eventos', 'los eventos publicados, con link a cada uno'],
    [
      'Para organizadores',
      '/organizadores',
      'cómo vender entradas, cobrar y manejar RRPP, equipo y puerta',
    ],
    ['Preguntas frecuentes', '/preguntas-frecuentes', 'compras y organización'],
    ...(['TERMS', 'ORGANIZER_TERMS', 'PRIVACY'] as const).map((key) => [
      LEGAL_DOCUMENTS[key].title,
      LEGAL_DOCUMENTS[key].href,
      'texto legal vigente',
    ]),
  ].map(([title, path, about]) => `- [${title}](${SITE_URL}${path}): ${about}`);

  // El título lo escribe el organizador: sin corchetes que corten el link.
  const linkText = (text: string) => text.replace(/[[\]]/g, '');
  const upcoming = (events?.items ?? []).map((event) => {
    const when = `${formatWeekdayDateTime(event.startDate, EVENT_TIME_ZONE)} hs`;
    const where = event.venueName ? ` · ${event.venueName}` : '';
    return `- [${linkText(event.title)}](${SITE_URL}${eventPath(event.id)}): ${when}${where}`;
  });

  const faq = FAQ_SECTIONS.flatMap((section) => [
    `### ${section.title}`,
    '',
    ...section.items.flatMap(({ question, answer }) => [
      `**${question}**`,
      answer,
      '',
    ]),
  ]);

  return [
    '# NeoPass',
    '',
    `> ${SITE_DESCRIPTION}`,
    '',
    'Sitio en español de Argentina. Los precios están en pesos argentinos y se pagan con Mercado Pago.',
    '',
    '## Páginas',
    '',
    ...pages,
    '',
    '## Próximos eventos',
    '',
    ...(upcoming.length > 0
      ? upcoming
      : [`- La lista al día está en ${SITE_URL}/eventos`]),
    '',
    '## Preguntas frecuentes',
    '',
    ...faq,
    '## Contacto',
    '',
    `- Correo: ${SUPPORT_EMAIL}`,
    `- Instagram: ${INSTAGRAM_URL}`,
    '',
  ].join('\n');
}
