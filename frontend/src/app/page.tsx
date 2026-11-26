import type { Metadata } from 'next';
import Landing from '@/components/landing/Landing';
import JsonLd from '@/components/seo/JsonLd';
import { homeJsonLd } from '@/utils/structured-data';

// La landing es de cliente; esta página de servidor le pone el título que
// muestra Google y los datos del sitio (nombre, logo y redes).
export const metadata: Metadata = {
  title: { absolute: 'NeoPass · Comprá y vendé entradas' },
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <JsonLd data={homeJsonLd()} />
      <Landing />
    </>
  );
}
