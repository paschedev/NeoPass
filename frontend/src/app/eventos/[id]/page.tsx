import { notFound } from 'next/navigation';
import EventDetail from '@/components/events/EventDetail';
import { fetchPublicEventResult } from '@/utils/event-metadata';

type Props = { params: Promise<{ id: string }> };

// El evento llega armado desde el servidor, con la misma consulta que usan
// la vista previa y la ficha para Google (se guarda un minuto). Si la API
// dice que no existe, la página responde 404 y Google lo saca; si la API no
// respondió, el navegador lo pide como antes.
export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const result = await fetchPublicEventResult(id);
  if (result.kind === 'missing') notFound();
  return (
    <EventDetail initialEvent={result.kind === 'found' ? result.event : null} />
  );
}
