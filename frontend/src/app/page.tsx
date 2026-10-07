'use client';

import Link from 'next/link';
import {
  Calendar,
  Ticket,
  ShieldCheck,
  ArrowRight,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getHomePath } from '@/utils/navigation';
import { isOrganizer } from '@/utils/roles';

export default function Home() {
  const { user } = useCurrentUser();

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative pt-24 pb-32 overflow-hidden">
          <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
              <Star className="w-4 h-4" /> La nueva era de los eventos
            </div>

            <h1 className="font-outfit text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white to-neutral-500">
              Viví experiencias únicas con{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
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
                      className="inline-flex w-max items-center justify-center gap-2 bg-indigo-600 border border-indigo-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/20"
                    >
                      {isOrganizer(user) ? 'Ir a mi panel' : 'Mis entradas'}
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/login"
                        className="inline-flex w-max items-center justify-center gap-2 bg-indigo-600 border border-indigo-500 text-white px-6 py-3 md:px-8 md:py-4 rounded-full font-semibold text-base md:text-lg transition-all hover:bg-indigo-500 active:scale-95 shadow-lg shadow-indigo-600/20"
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
        <section className="py-24 bg-neutral-900/50 border-t border-white/5">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="font-outfit text-3xl md:text-4xl font-bold mb-4">
                ¿Por qué elegir NeoPass?
              </h2>
              <p className="text-neutral-400 max-w-xl mx-auto">
                Pensada para quienes compran entradas y para quienes organizan
                eventos.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group bg-black/40 border border-white/10 rounded-3xl p-8 hover:bg-black/60 transition-colors">
                <div className="w-14 h-14 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">Tus datos, seguros</h3>
                <p className="text-neutral-400 leading-relaxed">
                  Navegás con conexión cifrada, tu contraseña nunca se guarda en
                  texto plano y los datos de tu tarjeta no pasan por NeoPass.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group bg-black/40 border border-white/10 rounded-3xl p-8 hover:bg-black/60 transition-colors">
                <div className="w-14 h-14 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Ticket className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">
                  Registrarte y comprar es fácil
                </h3>
                <p className="text-neutral-400 leading-relaxed">
                  Creás tu cuenta en un minuto, elegís tus entradas y pagás. Te
                  llegan por mail en PDF, para entrar aunque no haya señal.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group bg-black/40 border border-white/10 rounded-3xl p-8 hover:bg-black/60 transition-colors">
                <div className="w-14 h-14 bg-pink-500/20 text-pink-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Calendar className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold mb-3">
                  Control total para organizadores
                </h3>
                <p className="text-neutral-400 leading-relaxed">
                  Tandas con fechas y cupos, RPPs con comisión, co-organizadores
                  con permisos y escaneo en la puerta. Cobrás cada venta directo
                  en tu cuenta.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10">
        <div className="container mx-auto px-4 text-center text-neutral-500">
          <p>
            © {new Date().getFullYear()} NeoPass. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
