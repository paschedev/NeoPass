import type { Metadata } from 'next';
import { fetchEventMetadata } from '@/utils/event-metadata';

type Props = { params: Promise<{ id: string }> };

// La página del evento es de cliente: este layout de servidor solo arma la
// vista previa al compartir el link. Un layout recibe params y nunca los
// searchParams, así que el ?rpp= del link no llega a la API.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return fetchEventMetadata(id);
}

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
