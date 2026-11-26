import { serverApiUrl } from './site';

// Lo que devuelve GET /events por cada evento publicado que no terminó.
export type EventSummary = {
  id: string;
  title: string;
  imageUrl: string | null;
  startDate: string;
  endDate: string;
  venueName: string | null;
};

export type EventsPage = { items: EventSummary[]; total: number };

// Los que muestra /eventos de una vez; "Ver más" trae los siguientes.
export const EVENTS_PER_PAGE = 24;

const API_TIMEOUT_MS = 3000;

// Una página de GET /events pedida desde el servidor (la lista de eventos y
// el mapa del sitio). La respuesta se guarda `revalidate` segundos y se
// comparte entre todas las visitas: así la API recibe un pedido por período
// y no uno por visita, que llegarían todos desde la misma dirección. Si la
// API falla o tarda, devuelve null y quien la usa sigue sin esos datos.
export async function fetchPublicEventsPage(
  page: number,
  limit: number,
  revalidate: number,
): Promise<EventsPage | null> {
  try {
    const res = await fetch(
      `${serverApiUrl()}/events?page=${page}&limit=${limit}`,
      {
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
        next: { revalidate },
      },
    );
    if (!res.ok) return null;
    return (await res.json()) as EventsPage;
  } catch (error) {
    console.warn(`Public events page ${page} unavailable`, error);
    return null;
  }
}
