import type { Metadata } from 'next';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { WHATSAPP_URL, SUPPORT_EMAIL } from '@/utils/support';
import { INSTAGRAM_URL } from '@/utils/site';

export const metadata: Metadata = {
  title: 'Para organizadores',
  description:
    'Vendé las entradas de tu evento y cobrá directo en tu Mercado Pago. Sin abono ni costo de alta: el cargo de servicio lo paga quien compra. RRPP con link y comisión, equipo con permisos y scanners en la puerta.',
  alternates: { canonical: '/organizadores' },
};

// Los textos son los del documento de ventas v3 («NeoPass para
// organizadores»), aprobado por los dos socios: si cambia uno, cambia el otro.

const DIFFERENCES = [
  {
    topic: 'Cobro',
    usual: 'La ticketera cobra y te liquida después',
    neopass: 'La plata entra a tu Mercado Pago',
  },
  {
    topic: 'Costos',
    usual: 'Abono o comisión al organizador',
    neopass: 'Sin abono. El cargo lo paga quien compra',
  },
  {
    topic: 'RRPP',
    usual: 'Planillas y capturas para saber quién vendió',
    neopass: 'Cada RRPP con su link, sus ventas y su saldo',
  },
  {
    topic: 'Equipo',
    usual: 'Una sola cuenta compartida',
    neopass: 'Cada uno con sus permisos',
  },
  {
    topic: 'Puerta',
    usual: 'Listas impresas',
    neopass: 'Scanner en el celular con el ingreso en vivo',
  },
];

const PAYMENT_POINTS = [
  'Quien compra paga con Mercado Pago y la plata entra directo a tu cuenta. NeoPass no retiene tu plata.',
  'Vos elegís cuándo cobrar en tu cuenta de Mercado Pago. Cuanto antes cobrás, más cobra Mercado Pago por venta.',
  'Ese costo se reparte a medias entre quien compra y vos.',
  'Sin abono ni costo de alta. El cargo de servicio lo paga quien compra.',
];

const FEATURES = [
  {
    id: 'ventas',
    title: 'Tus ventas en vivo',
    lead: 'Sabés cuánto vendiste en cada momento. En total y en cada evento.',
    points: [
      'Lo recaudado y las entradas vendidas',
      'El detalle por tanda y por tipo de entrada',
      'Te avisa cada vez que se vende',
    ],
  },
  {
    id: 'rrpp',
    title: 'Tus RRPP bajo control',
    lead: 'Cada RRPP vende con su link. Vos sabés cuánto vendió y cuánto le debés.',
    points: [
      'Comisión por porcentaje o monto fijo',
      'Registrás cada pago y el saldo queda al día',
      'Si querés le das QR free con un tope',
    ],
  },
  {
    id: 'equipo',
    title: 'Tu equipo con permisos',
    lead: 'Sumá co-organizadores y elegí qué puede hacer cada uno.',
    points: [
      'Ventas, tandas, QR free, público o staff',
      'Cobrar, publicar y cancelar es solo tuyo',
      'Cada cambio queda con nombre y hora',
    ],
  },
  {
    id: 'puerta',
    title: 'La puerta bajo control',
    lead: 'Tu staff escanea con su celular. Vos ves cuánta gente entró.',
    points: [
      'Invitás scanners para la puerta',
      'El mismo QR no entra dos veces',
      'El ingreso se actualiza solo durante el evento',
    ],
  },
];

const STEPS = [
  {
    title: 'Vinculá Mercado Pago',
    text: 'Conectás tu cuenta y cada venta se acredita directo en ella.',
  },
  {
    title: 'Creá tu evento',
    text: 'Cargás el flyer, el lugar y las tandas con sus precios y cupos.',
  },
  {
    title: 'Sumá a tu equipo',
    text: 'Invitás RRPP con su link, scanners para la puerta y co-organizadores.',
  },
];

const PRIMARY =
  'inline-flex justify-center bg-white text-black px-6 py-3 rounded-xl font-medium hover:bg-neutral-200 transition-colors';
const SECONDARY =
  'inline-flex justify-center bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-medium transition-colors border border-white/10';
const SECTION_TITLE = 'font-outfit text-3xl md:text-4xl font-bold text-white';

function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={SECONDARY}
    >
      Escribinos por WhatsApp
    </a>
  );
}

export default function OrganizadoresPage() {
  return (
    <div className="container mx-auto px-4 pt-6 pb-24 md:pt-16 md:pb-12">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold text-indigo-400 mb-3">
          Para organizadores
        </p>
        <h1 className="font-outfit text-4xl md:text-6xl font-bold text-white leading-tight">
          Tu evento en orden de punta a punta
        </h1>
        <p className="mt-5 text-lg text-neutral-300 leading-relaxed">
          Vendé tus entradas, manejá a tu equipo y controlá la puerta desde el
          celular. Sin instalar nada, para vos, para tu equipo y para quien
          compra.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Link href="/registro" className={PRIMARY}>
            Crear cuenta
          </Link>
          <WhatsAppButton />
        </div>
      </header>

      <section aria-labelledby="diferencias" className="mt-20 md:mt-28">
        <h2 id="diferencias" className={SECTION_TITLE}>
          Lo que nos diferencia
        </h2>
        {/* Una tabla con líneas: en el celular cada fila se apila. */}
        <table className="mt-8 w-full text-left">
          <thead className="hidden md:table-header-group">
            <tr className="text-sm text-neutral-500">
              <th scope="col" className="pb-3 font-medium w-1/5">
                <span className="sr-only">Tema</span>
              </th>
              <th scope="col" className="pb-3 font-medium w-2/5">
                Lo habitual
              </th>
              <th scope="col" className="pb-3 font-medium w-2/5 text-white">
                Con NeoPass
              </th>
            </tr>
          </thead>
          <tbody>
            {DIFFERENCES.map(({ topic, usual, neopass }) => (
              <tr
                key={topic}
                className="block md:table-row border-t border-white/10 py-4 md:py-0"
              >
                <th
                  scope="row"
                  className="block md:table-cell md:py-5 font-semibold text-white"
                >
                  {topic}
                </th>
                <td className="block md:table-cell mt-1 md:mt-0 md:py-5 md:pr-6 text-neutral-500">
                  <span className="md:hidden">Lo habitual: </span>
                  {usual}
                </td>
                <td className="block md:table-cell mt-1 md:mt-0 md:py-5 text-white">
                  <span className="flex items-start gap-2">
                    <Check
                      aria-hidden="true"
                      className="w-5 h-5 shrink-0 mt-0.5 text-indigo-400"
                    />
                    <span>
                      <span className="md:hidden">Con NeoPass: </span>
                      {neopass}
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="como-cobras" className="mt-20 md:mt-28 max-w-3xl">
        <h2 id="como-cobras" className={SECTION_TITLE}>
          Cómo cobrás
        </h2>
        <p className="mt-4 text-neutral-400">
          Antes de ver tus ventas: así te llega la plata.
        </p>
        <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
          {PAYMENT_POINTS.map((point) => (
            <li key={point} className="py-4 text-neutral-200 leading-relaxed">
              {point}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-20 md:mt-28 grid md:grid-cols-2 gap-x-14 gap-y-14">
        {FEATURES.map(({ id, title, lead, points }) => (
          <section
            key={id}
            aria-labelledby={`funcion-${id}`}
            className="border-t border-white/15 pt-6"
          >
            <h2
              id={`funcion-${id}`}
              className="font-outfit text-2xl md:text-3xl font-bold text-white"
            >
              {title}
            </h2>
            <p className="mt-3 text-neutral-300 leading-relaxed">{lead}</p>
            <ul className="mt-5 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <Check
                    aria-hidden="true"
                    className="w-5 h-5 shrink-0 mt-0.5 text-neutral-400"
                  />
                  <span className="text-neutral-300">{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section aria-labelledby="empeza-hoy" className="mt-20 md:mt-28 max-w-3xl">
        <h2 id="empeza-hoy" className={SECTION_TITLE}>
          Empezá hoy
        </h2>
        <p className="mt-4 text-neutral-400">
          Tres pasos y tu evento está a la venta.
        </p>
        <ol className="mt-8 space-y-6">
          {STEPS.map(({ title, text }, index) => (
            <li key={title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="shrink-0 w-9 h-9 rounded-full bg-brand-500/15 text-brand-300 font-bold flex items-center justify-center"
              >
                {index + 1}
              </span>
              <div>
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-neutral-400 leading-relaxed">{text}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-10">
          <Link href="/registro" className={PRIMARY}>
            Crear cuenta
          </Link>
        </div>
      </section>

      <section
        aria-labelledby="contacto"
        className="mt-20 md:mt-28 border-t border-white/10 pt-10"
      >
        <h2 id="contacto" className={SECTION_TITLE}>
          ¿Alguna duda? Contactanos
        </h2>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <WhatsAppButton />
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-neutral-300 hover:text-white transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-300 hover:text-white transition-colors"
          >
            @neopass.ar
          </a>
        </div>
        <p className="mt-6 text-neutral-400">
          También podés leer las{' '}
          <Link
            href="/preguntas-frecuentes"
            className="text-white underline underline-offset-4 hover:text-indigo-300"
          >
            preguntas frecuentes
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
