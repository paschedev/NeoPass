'use client';

import Image from 'next/image';
import Link from 'next/link';
import Wordmark from '@/components/Wordmark';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isOrganizer } from '@/utils/roles';
import { SUPPORT_EMAIL } from '@/utils/support';

const TITLE = 'text-sm font-semibold text-white mb-4';
const LINK = 'text-neutral-300 hover:text-white transition-colors';

// El cierre de la landing: una foto a todo el ancho con el borde de arriba en
// diagonal y, encima, los accesos y el contacto. En PC la foto queda fija
// mientras la página pasa por encima (el clip-path del pie la recorta); en
// celular se desplaza normal.
export default function LandingFooter() {
  const { user, ready } = useCurrentUser();

  return (
    <footer className="relative isolate text-neutral-300 [clip-path:polygon(0_3rem,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(0_6rem,100%_0,100%_100%,0_100%)]">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 md:fixed">
          <Image
            src="/landing/cierre.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/40 via-neutral-950/80 to-neutral-950" />
      </div>

      <div className="container mx-auto px-4 pt-40 md:pt-64 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div className="col-span-2 md:col-span-1">
            <Wordmark className="text-3xl text-white" />
          </div>

          <nav aria-labelledby="pie-eventos">
            <h2 id="pie-eventos" className={TITLE}>
              Eventos
            </h2>
            <ul className="space-y-3">
              <li>
                <Link href="/eventos" className={LINK}>
                  Explorar eventos
                </Link>
              </li>
              <li>
                <a href="#como-funciona" className={LINK}>
                  Cómo funciona
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-labelledby="pie-cuenta">
            <h2 id="pie-cuenta" className={TITLE}>
              Tu cuenta
            </h2>
            {/* Hasta saber si hay sesión quedan invisibles, con su lugar
                reservado, como los botones del hero. */}
            <ul className={`space-y-3 ${ready ? '' : 'invisible'}`}>
              {user ? (
                <>
                  <li>
                    <Link href="/panel/tickets" className={LINK}>
                      Mis entradas
                    </Link>
                  </li>
                  {isOrganizer(user) && (
                    <li>
                      <Link href="/panel" className={LINK}>
                        Mi panel
                      </Link>
                    </li>
                  )}
                </>
              ) : (
                <>
                  <li>
                    <Link href="/login" className={LINK}>
                      Ingresar
                    </Link>
                  </li>
                  <li>
                    <Link href="/registro" className={LINK}>
                      Crear cuenta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>

          <div className="col-span-2 md:col-span-1">
            <h2 className={TITLE}>Ayuda</h2>
            <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
              {SUPPORT_EMAIL}
            </a>
          </div>
        </div>

        <p className="mt-12 pt-6 border-t border-white/10 text-sm text-neutral-400">
          © {new Date().getFullYear()} NeoPass. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
