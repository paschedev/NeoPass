import { buildLlmsTxt } from '@/utils/llms-txt';

// /llms.txt, la guía para buscadores con IA. Se arma en cada pedido con la
// lista de eventos guardada 10 minutos, como el mapa del sitio.
export const revalidate = 0;

const EVENTS_REVALIDATE_SECONDS = 600;

export async function GET() {
  return new Response(await buildLlmsTxt(EVENTS_REVALIDATE_SECONDS), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
