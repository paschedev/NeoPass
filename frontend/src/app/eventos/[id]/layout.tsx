import type { Metadata } from 'next';
import { Suspense } from 'react';
import JsonLd from '@/components/seo/JsonLd';
import { fetchEventMetadata, fetchPublicEvent } from '@/utils/event-metadata';
import { eventJsonLd } from '@/utils/structured-data';

type Props = { params: Promise<{ id: string }> };

// La página del evento es de cliente: este layout de servidor arma la vista
// previa al compartir el link y la ficha para Google. Un layout recibe params
// y nunca los searchParams, así que el ?rpp= del link no llega a la API.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return fetchEventMetadata(id);
}

async function EventJsonLd({ params }: Props) {
  const { id } = await params;
  const event = await fetchPublicEvent(id);
  return event ? <JsonLd data={eventJsonLd(event, id)} /> : null;
}

export default function EventLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  return (
    <>
      {/* Aparte, para que la página no espere a la API. */}
      <Suspense fallback={null}>
        <EventJsonLd params={params} />
      </Suspense>
      {children}
    </>
  );
}
