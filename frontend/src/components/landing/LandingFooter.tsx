'use client';

import Link from 'next/link';
import Logo from '@/components/brand/Logo';
import { TelaSuperior } from '@/components/brand/Telas';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LEGAL_DOCUMENTS } from '@/utils/legal';
import { isOrganizer } from '@/utils/roles';
import { INSTAGRAM_URL } from '@/utils/site';
import { SUPPORT_EMAIL } from '@/utils/support';

const TITLE = 'text-sm font-semibold text-white mb-4';
const LINK = 'text-neutral-300 hover:text-white transition-colors';

// La Ventanilla Única Federal, con el texto que exige la Res. 274/2021.
const CONSUMER_DEFENSE_URL =
  'https://www.argentina.gob.ar/produccion/defensadelconsumidor/formulario';

// Hasta que exista el pedido en la plataforma, el botón de arrepentimiento
// abre un correo a soporte con lo que necesitamos para encontrar la compra.
const WITHDRAWAL_SUBJECT = encodeURIComponent('Botón de arrepentimiento');
const WITHDRAWAL_BODY = encodeURIComponent(
  'Quiero revocar mi compra.\nEvento:\nFecha de la compra:\n',
);
const WITHDRAWAL_HREF = `mailto:${SUPPORT_EMAIL}?subject=${WITHDRAWAL_SUBJECT}&body=${WITHDRAWAL_BODY}`;

// lucide-react ya no trae logos de marcas: este sigue su trazo.
function InstagramIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-5 h-5"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// El cierre de la landing: el borde de arriba en diagonal, la misma tela de
// las razones entrando por la derecha y, debajo, los accesos y el contacto. En
// PC la tela queda fija mientras la página pasa (el clip-path del pie la
// recorta), como en las razones; en celular se desplaza con el pie. Arriba se
// funde con el fondo para que la diagonal no la corte en seco, y la capa
// oscura la apaga antes de llegar a los links.
export default function LandingFooter() {
  const { user, ready } = useCurrentUser();

  return (
    <footer className="relative isolate text-neutral-300 [clip-path:polygon(0_3rem,100%_0,100%_100%,0_100%)] md:[clip-path:polygon(0_6rem,100%_0,100%_100%,0_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute inset-0 overflow-clip md:fixed">
          <TelaSuperior className="absolute top-0 -right-[30%] w-[110%] md:top-[6%] md:-right-[2%] md:w-[58%] md:max-w-[1000px]" />
        </div>
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-neutral-950 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/10 via-neutral-950/80 to-neutral-950" />
      </div>

      <div className="container mx-auto px-4 pt-40 md:pt-64 pb-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 md:col-span-1 flex flex-col items-start">
            <Logo className="h-8 w-auto text-white" />
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="NeoPass en Instagram"
              className={`mt-4 inline-flex items-center gap-2 ${LINK}`}
            >
              <InstagramIcon />
              @neopass.ar
            </a>
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
              <li>
                <Link href="/organizadores" className={LINK}>
                  Para organizadores
                </Link>
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
            <ul className="space-y-3">
              <li>
                <Link href="/preguntas-frecuentes" className={LINK}>
                  Preguntas frecuentes
                </Link>
              </li>
              <li>
                <a href={`mailto:${SUPPORT_EMAIL}`} className={LINK}>
                  {SUPPORT_EMAIL}
                </a>
              </li>
            </ul>
          </div>

          <nav aria-labelledby="pie-legal" className="col-span-2 md:col-span-1">
            <h2 id="pie-legal" className={TITLE}>
              Legal
            </h2>
            <ul className="space-y-3">
              {(['TERMS', 'ORGANIZER_TERMS', 'PRIVACY'] as const).map((key) => (
                <li key={key}>
                  <Link href={LEGAL_DOCUMENTS[key].href} className={LINK}>
                    {LEGAL_DOCUMENTS[key].title}
                  </Link>
                </li>
              ))}
              <li>
                <a href={WITHDRAWAL_HREF} className={LINK}>
                  Botón de arrepentimiento
                </a>
              </li>
              <li>
                <a
                  href={CONSUMER_DEFENSE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={LINK}
                >
                  Defensa de las y los Consumidores. Para reclamos ingrese aquí
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <p className="mt-12 pt-6 border-t border-white/10 text-sm text-neutral-400">
          © {new Date().getFullYear()} NeoPass. Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
}
