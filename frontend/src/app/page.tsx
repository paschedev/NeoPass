'use client';

import Link from 'next/link';
import {
  Calendar,
  Ticket,
  ShieldCheck,
  ArrowRight,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Wordmark from '@/components/Wordmark';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getHomePath } from '@/utils/navigation';
import { isOrganizer } from '@/utils/roles';

type Reason = {
  id: string;
  title: string;
  text: string;
  Icon: LucideIcon;
  iconClass: string;
  size: 'regular' | 'featured';
};

// Every claim here has to hold in the code (or in the infrastructure, like
// Neon encrypting stored data): no promises the app does not keep.
const REASONS: Reason[] = [
  {
    id: 'datos',
    title: 'Conexión y datos cifrados',
    text: 'Tu información viaja y se guarda cifrada. Tu contraseña no la conoce nadie, ni siquiera nosotros, y tu tarjeta la cargás en Mercado Pago: nunca pasa por NeoPass.',
    Icon: ShieldCheck,
    iconClass: 'bg-purple-500/20 text-purple-400',
    size: 'regular',
  },
  {
    id: 'facilidad',
    title: 'Facilidad de uso',
    text: 'Creás tu cuenta en un minuto, elegís tus entradas y pagás. Te llegan por correo para entrar aunque no haya señal.',
    Icon: Ticket,
    iconClass: 'bg-indigo-500/20 text-indigo-400',
    size: 'regular',
  },
  {
    id: 'orden',
    title: 'Orden y flexibilidad',
    text: 'Control total de tu evento: tandas con fechas y cupos, RPPs, scanners en la puerta y co-organizadores con los permisos que vos elijas.',
    Icon: Calendar,
    iconClass: 'bg-pink-500/20 text-pink-400',
    size: 'regular',
  },
  {
    id: 'cobro',
    title: 'Cobro directo con Mercado Pago',
    text: 'Vinculás tu cuenta de Mercado Pago y cada venta se acredita directo en ella. NeoPass no retiene tu plata y el cargo de servicio lo paga quien compra.',
    Icon: Wallet,
    iconClass: 'bg-emerald-500/20 text-emerald-400',
    size: 'featured',
  },
];

const REASON_STYLES = {
  regular: { card: 'p-8', title: 'text-xl', text: '' },
  featured: {
    card: 'md:col-span-3 p-8 md:p-10',
    title: 'text-2xl',
    text: 'md:text-lg',
  },
};

// Comprar exige cuenta (el botón lleva al login) y crear un evento exige
// tener Mercado Pago vinculado: por eso el orden de los pasos.
const HOW_IT_WORKS = [
  {
    id: 'compras',
    audience: 'Si comprás',
    steps: [
      {
        title: 'Elegí tu evento',
        text: 'Buscás el evento y elegís tus entradas.',
      },
      {
        title: 'Pagá con Mercado Pago',
        text: 'Entrás con tu cuenta y confirmás el pago.',
      },
      {
        title: 'Entrá con tu QR',
        text: 'Las entradas te llegan por correo y quedan en Mis entradas. En la puerta escanean tu QR.',
      },
    ],
  },
  {
    id: 'organizas',
    audience: 'Si organizás',
    steps: [
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
        text: 'Invitás RPPs con su link, scanners para la puerta y co-organizadores.',
      },
    ],
  },
];

export default function Home() {
  const { user } = useCurrentUser();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
          >
            <div className="absolute -top-32 -left-24 w-80 h-80 md:w-[32rem] md:h-[32rem] rounded-full bg-brand-600/15 blur-3xl motion-safe:animate-drift" />
            <div className="absolute top-1/3 -right-24 w-72 h-72 md:w-[28rem] md:h-[28rem] rounded-full bg-brand-accent/10 blur-3xl motion-safe:animate-drift [animation-delay:-12s]" />
          </div>
          <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
            <h1 className="font-outfit text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500">
              Viví experiencias únicas con{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-brand-accent">
                NeoPass
              </span>
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed">
              Comprá tus entradas de forma rápida y segura. Organizá tus eventos
              desde un solo lugar, con control total y cobros directos en tu
              cuenta.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto min-h-[60px] items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key="buttons"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="flex flex-col sm:flex-row gap-4 items-center"
                >
                  <Link
                    href="/eventos"
                    className="group w-max relative inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-xl shadow-white/10"
                  >
                    <span className="relative z-10">Explorar eventos</span>
                    <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
                  </Link>

                  {user ? (
                    <Link
                      href={getHomePath(user)}
                      className="inline-flex w-max items-center justify-center gap-2 bg-brand-600 border border-brand-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-brand-500 active:scale-95 shadow-lg shadow-brand-600/20"
                    >
                      {isOrganizer(user) ? 'Ir a mi panel' : 'Mis entradas'}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="inline-flex w-max items-center justify-center gap-2 bg-brand-600 border border-brand-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-brand-500 active:scale-95 shadow-lg shadow-brand-600/20"
                      >
                        Ingresar
                      </Link>
                      <Link
                        href="/registro"
                        className="inline-flex w-max items-center justify-center gap-2 bg-white/5 border border-white/10 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-white/10 active:scale-95"
                      >
                        Crear cuenta
                      </Link>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section
          aria-labelledby="por-que-neopass"
          className="py-24 bg-neutral-900/50 border-t border-white/5"
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2
                id="por-que-neopass"
                className="font-outfit text-3xl md:text-4xl font-bold mb-4"
              >
                ¿Por qué elegir NeoPass?
              </h2>
              <p className="text-neutral-400 max-w-xl mx-auto">
                Pensada para quienes compran entradas y para quienes organizan
                eventos.
              </p>
            </div>

            <div className="reveal grid md:grid-cols-3 gap-8">
              {REASONS.map(({ id, title, text, Icon, iconClass, size }) => {
                const styles = REASON_STYLES[size];
                return (
                  <article
                    key={id}
                    aria-labelledby={`razon-${id}`}
                    className={`group bg-black/40 border border-white/10 rounded-3xl hover:bg-black/60 transition-colors ${styles.card}`}
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${iconClass}`}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <h3
                        id={`razon-${id}`}
                        className={`font-bold ${styles.title}`}
                      >
                        {title}
                      </h3>
                    </div>
                    <p
                      className={`text-neutral-400 leading-relaxed ${styles.text}`}
                    >
                      {text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="como-funciona"
          className="py-24 border-t border-white/5"
        >
          <div className="container mx-auto px-4">
            <h2
              id="como-funciona"
              className="font-outfit text-3xl md:text-4xl font-bold text-center mb-16"
            >
              Cómo funciona
            </h2>

            <div className="reveal grid md:grid-cols-2 gap-8">
              {HOW_IT_WORKS.map(({ id, audience, steps }) => (
                <div
                  key={id}
                  className="bg-black/40 border border-white/10 rounded-3xl p-8"
                >
                  <h3 id={`pasos-${id}`} className="text-xl font-bold mb-6">
                    {audience}
                  </h3>
                  <ol aria-labelledby={`pasos-${id}`} className="space-y-6">
                    {steps.map(({ title, text }, index) => (
                      <li key={title} className="flex gap-4">
                        <span
                          aria-hidden="true"
                          className="shrink-0 w-9 h-9 rounded-full bg-brand-500/15 text-brand-300 font-bold flex items-center justify-center"
                        >
                          {index + 1}
                        </span>
                        <div>
                          <h4 className="font-semibold mb-1">{title}</h4>
                          <p className="text-neutral-400 leading-relaxed">
                            {text}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10">
        <div className="container mx-auto px-4 flex flex-col items-center gap-3 text-center text-neutral-500">
          <Wordmark className="text-2xl text-white" />
          <p>
            © {new Date().getFullYear()} NeoPass. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
