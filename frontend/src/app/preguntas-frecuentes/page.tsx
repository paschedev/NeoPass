import type { Metadata } from 'next';
import Link from 'next/link';
import JsonLd from '@/components/seo/JsonLd';
import { FAQ_SECTIONS } from '@/utils/faq';
import { faqJsonLd } from '@/utils/structured-data';
import { SUPPORT_EMAIL } from '@/utils/support';

export const metadata: Metadata = {
  title: 'Preguntas frecuentes',
  description:
    'Cómo recibís y transferís tus entradas, qué pasa si se cancela un evento, cuánto cuesta organizar con NeoPass y cómo cobrás en Mercado Pago.',
  alternates: { canonical: '/preguntas-frecuentes' },
};

// Todas las respuestas a la vista, sin desplegables: se leen de corrido y
// los buscadores con IA las encuentran en el HTML.
export default function PreguntasFrecuentesPage() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-24 md:pt-12 md:pb-12 max-w-3xl">
      <JsonLd data={faqJsonLd(FAQ_SECTIONS)} />
      <h1 className="font-outfit text-4xl md:text-5xl font-bold text-white">
        Preguntas frecuentes
      </h1>
      <p className="mt-4 text-neutral-400">
        Lo que más nos preguntan quienes compran y quienes organizan.
      </p>

      {FAQ_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`faq-${section.id}`}
          className="mt-14"
        >
          <h2
            id={`faq-${section.id}`}
            className="font-outfit text-2xl md:text-3xl font-bold text-white mb-2"
          >
            {section.title}
          </h2>
          <dl className="divide-y divide-white/10">
            {section.items.map(({ question, answer }) => (
              <div key={question} className="py-6">
                <dt className="font-semibold text-lg text-white">{question}</dt>
                <dd className="mt-2 text-neutral-300 leading-relaxed">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <div className="mt-14 border-t border-white/10 pt-8 text-neutral-400">
        <p>
          ¿No encontraste tu respuesta? Escribinos a{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-white underline underline-offset-4 hover:text-indigo-300"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
        <p className="mt-2">
          Si organizás eventos, mirá{' '}
          <Link
            href="/organizadores"
            className="text-white underline underline-offset-4 hover:text-indigo-300"
          >
            todo lo que NeoPass hace por vos
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
