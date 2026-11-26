import EventsList from '@/components/events/EventsList';
import { EVENTS_PER_PAGE, fetchPublicEventsPage } from '@/utils/public-events';

// La página se arma en cada visita, con la primera tanda de eventos ya
// escrita: así Google encuentra los links sin esperar al JavaScript. La lista
// se le pide a la API como mucho una vez por minuto y se comparte entre todas
// las visitas; un evento nuevo aparece en menos de un minuto.
export const revalidate = 0;

const EVENTS_REVALIDATE_SECONDS = 60;

export default async function EventosPage() {
  const firstPage = await fetchPublicEventsPage(
    1,
    EVENTS_PER_PAGE,
    EVENTS_REVALIDATE_SECONDS,
  );
  return <EventsList initialPage={firstPage} />;
}
