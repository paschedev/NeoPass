'use client';

import type { MouseEvent } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Ticket,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import Logo from '@/components/brand/Logo';
import { TelaSuperior } from '@/components/brand/Telas';
import HeroBadge from '@/components/landing/HeroBadge';
import LandingDemo from '@/components/landing/LandingDemo';
import LandingFooter from '@/components/landing/LandingFooter';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getHomePath } from '@/utils/navigation';
import { isOrganizer } from '@/utils/roles';

type Reason = {
  id: string;
  title: string;
  text: string;
  Icon: LucideIcon;
};

// Every claim here has to hold in the code (or in the infrastructure, like
// Neon encrypting stored data): no promises the app does not keep.
const REASONS: Reason[] = [
  {
    id: 'datos',
    title: 'Conexión y datos cifrados',
    text: 'Tu información viaja y se guarda cifrada. Tu contraseña no la conoce nadie, ni siquiera nosotros, y tu tarjeta nunca pasa por NeoPass.',
    Icon: ShieldCheck,
  },
  {
    id: 'facilidad',
    title: 'Facilidad de uso',
    text: 'Creás tu cuenta en un minuto, elegís tus entradas y pagás. Te llegan por correo para entrar aunque no haya señal.',
    Icon: Ticket,
  },
  {
    id: 'orden',
    title: 'Orden y flexibilidad',
    text: 'Control total de tu evento: tandas con fechas y cupos, RRPP, scanners en la puerta y co-organizadores con los permisos que vos elijas.',
    Icon: Calendar,
  },
  {
    id: 'cobro',
    title: 'Cobro directo con Mercado Pago',
    text: 'Vinculás tu cuenta de Mercado Pago y cada venta se acredita directo en ella. NeoPass no retiene tu plata y el cargo de servicio lo paga quien compra.',
    Icon: Wallet,
  },
];

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
        text: 'Invitás RRPP con su link, scanners para la puerta y co-organizadores.',
      },
    ],
  },
];

// La flecha del hero baja hasta las razones con una transición suave, o de
// golpe si se pidió reducir el movimiento. El href queda para el teclado y
// por si no hay JavaScript.
function scrollToReasons(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  document.getElementById('razones')?.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  });
}

export default function Landing() {
  const { user, ready } = useCurrentUser();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        {/* Hero: en PC ocupa justo la pantalla, como en celular. */}
        <section className="relative pt-24 pb-32 overflow-clip md:min-h-svh md:flex md:flex-col md:justify-center md:py-16">
          {/* Detrás, la marca repetida y muy apagada, como la pared de
              patrocinadores de una conferencia: en el celular la N sola, en PC
              filas de neopass y N inclinadas como las letras. Se apaga detrás
              del texto y abajo (globals.css, .patron-inicio). Quieta y sin
              clics. */}
          <div
            aria-hidden="true"
            className="patron-inicio pointer-events-none absolute inset-0"
          >
            <div className="absolute inset-0 bg-[url(/landing/patron-celular.svg)] bg-[length:60.48px_60.48px] bg-top md:hidden" />
            <div className="absolute -inset-[30%] hidden -rotate-9 bg-[url(/landing/patron-pc.svg)] bg-[length:290.77px_108px] bg-top md:block" />
          </div>

          <div className="reveal-out container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
            <HeroBadge className="inline-flex mb-6 md:mb-8 motion-safe:animate-fade-up" />

            {/* El nombre es el logo: sus minúsculas miden lo que las
                mayúsculas del título y la base de sus letras cae en la línea
                del texto (el 16,5 % de abajo es la cola de la "p"). */}
            <h1 className="font-outfit text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-white motion-safe:animate-fade-up [--delay:100ms]">
              Viví experiencias únicas con{' '}
              <Logo className="inline-block h-[0.85em] w-auto align-[-0.14em]" />
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mb-10 leading-relaxed motion-safe:animate-fade-up [--delay:200ms]">
              Comprá tus entradas de forma rápida y segura. Organizá tus eventos
              desde un solo lugar, con control total y cobros directos en tu
              cuenta.
            </p>

            {/* Hasta saber si hay sesión no se muestran (el lugar queda
                reservado): así no aparece "Ingresar" y cambia a "Ir a mi panel". */}
            <div
              className={`flex flex-col sm:flex-row gap-4 w-full sm:w-auto min-h-[60px] items-center justify-center ${
                ready
                  ? 'motion-safe:animate-fade-up [--delay:300ms]'
                  : 'invisible'
              }`}
            >
              <Link
                href="/eventos"
                className="group w-max inline-flex items-center justify-center gap-2 bg-white text-black px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-colors hover:bg-neutral-200 active:scale-95"
              >
                <span>Explorar eventos</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>

              {user ? (
                <Link
                  href={getHomePath(user)}
                  className="inline-flex w-max items-center justify-center gap-2 bg-brand-600 border border-brand-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-brand-500 active:scale-95"
                >
                  {isOrganizer(user) ? 'Ir a mi panel' : 'Mis entradas'}
                </Link>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex w-max items-center justify-center gap-2 bg-brand-600 border border-brand-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-brand-500 active:scale-95"
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
            </div>
          </div>

          {/* Con el hero a pantalla completa, avisa que hay más abajo. */}
          <a
            href="#razones"
            onClick={scrollToReasons}
            aria-label="Ver por qué elegir NeoPass"
            className="hidden md:flex absolute bottom-8 inset-x-0 mx-auto w-fit p-2.5 rounded-full border border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10 hover:border-white/30 hover:text-white transition-colors motion-safe:animate-nudge"
          >
            <ChevronDown className="w-6 h-6" />
          </a>
        </section>

        {/* Detrás entra una tela por la derecha: en PC queda fija y la sección
            es una ventana (el clip-path la recorta); en celular se desplaza con
            la sección. Una capa oscura la baja detrás del texto y se funde
            arriba y abajo con el fondo de la página.
            - El fondo sobra 4 px arriba y abajo: el navegador redondea distinto
              el recorte de la capa fija y la oscura, y en el borde quedaba una
              fila sin oscurecer.
            - Sin desenfoque en las razones: sobre una capa fija se recalcula en
              cada cuadro del scroll y baja los FPS. */}
        <section
          id="razones"
          aria-labelledby="por-que-neopass"
          className="relative isolate py-24 [clip-path:inset(0)]"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-0 -inset-y-1 -z-10"
          >
            <div className="absolute inset-0 overflow-clip md:fixed">
              <TelaSuperior className="absolute top-0 -right-[58%] w-[130%] md:top-[6%] md:-right-[2%] md:w-[58%] md:max-w-[1000px]" />
            </div>
            <div className="absolute inset-0 bg-neutral-950/45" />
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neutral-950 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-neutral-950 to-transparent" />
          </div>
          <div className="container mx-auto px-4">
            <div className="reveal mb-12 max-w-2xl">
              <h2
                id="por-que-neopass"
                className="font-outfit text-3xl md:text-4xl font-bold mb-4"
              >
                ¿Por qué elegir NeoPass?
              </h2>
              <p className="text-neutral-400">
                Pensada para quienes compran entradas y para quienes organizan
                eventos.
              </p>
            </div>

            {/* Una lista, no tarjetas: cada razón separada por una línea y
                con el ícono gris al lado del título. */}
            <div className="grid md:grid-cols-2 gap-x-14 gap-y-10">
              {REASONS.map(({ id, title, text, Icon }) => (
                <article
                  key={id}
                  aria-labelledby={`razon-${id}`}
                  className="reveal border-t border-white/15 pt-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Icon
                      aria-hidden="true"
                      className="w-5 h-5 shrink-0 text-neutral-400"
                    />
                    <h3 id={`razon-${id}`} className="font-bold text-xl">
                      {title}
                    </h3>
                  </div>
                  <p className="text-neutral-300 leading-relaxed">{text}</p>
                </article>
              ))}
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
              className="reveal scroll-mt-24 font-outfit text-3xl md:text-4xl font-bold mb-12"
            >
              Cómo funciona
            </h2>

            {/* La tarjeta solo entra; cada paso entra y sale por su cuenta,
                así no se desvanece el paso que se está leyendo. */}
            <div className="grid md:grid-cols-2 gap-8">
              {HOW_IT_WORKS.map(({ id, audience, steps }) => (
                <div
                  key={id}
                  className="reveal-in bg-black/40 border border-white/10 rounded-3xl p-8"
                >
                  <h3 id={`pasos-${id}`} className="text-xl font-bold mb-6">
                    {audience}
                  </h3>
                  <ol aria-labelledby={`pasos-${id}`} className="space-y-6">
                    {steps.map(({ title, text }, index) => (
                      <li key={title} className="reveal flex gap-4">
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

        <section
          aria-labelledby="por-dentro"
          className="py-24 border-t border-white/5"
        >
          <div className="container mx-auto px-4">
            <div className="reveal mb-10 max-w-2xl">
              <h2
                id="por-dentro"
                className="font-outfit text-3xl md:text-4xl font-bold mb-4"
              >
                Así se ve por dentro
              </h2>
              <p className="text-neutral-400">
                El panel de quien organiza y el de un RRPP, con datos de
                ejemplo.
              </p>
            </div>
            <div className="reveal-in">
              <LandingDemo />
            </div>
          </div>
        </section>
      </div>

      <LandingFooter />
    </div>
  );
}
