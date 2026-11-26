import type { Metadata } from 'next';

// La lista de eventos es de cliente: este layout le pone título y
// descripción para Google. Cada evento los reemplaza por los suyos.
export const metadata: Metadata = {
  title: 'Eventos',
  description:
    'Descubrí los próximos eventos y comprá tus entradas de forma rápida y segura.',
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
