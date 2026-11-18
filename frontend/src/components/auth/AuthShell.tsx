import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, Ticket } from 'lucide-react';

// El marco de Ingresar y Registro: una columna angosta y centrada sobre el
// fondo, con el resplandor de la landing y la vuelta al inicio arriba.
export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-neutral-950 px-4 pt-6 pb-24 md:pb-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-32 w-96 h-96 md:w-[36rem] md:h-[36rem] rounded-full bg-brand-600/15 blur-3xl motion-safe:animate-drift" />
        <div className="absolute -bottom-40 -right-32 w-96 h-96 md:w-[32rem] md:h-[32rem] rounded-full bg-brand-accent/10 blur-3xl motion-safe:animate-drift [--delay:-12s]" />
      </div>

      <Link
        href="/"
        className="relative inline-flex items-center gap-1 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Inicio
      </Link>

      <main className="relative mx-auto w-full max-w-sm pt-10 md:pt-20">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900 shadow-lg shadow-brand-600/10">
            <Ticket className="h-6 w-6 text-brand-400" />
          </div>
          <h1 className="font-outfit text-2xl md:text-3xl font-bold tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 text-sm text-neutral-400">{subtitle}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

// "o" entre Google y el formulario.
export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-4 text-xs text-neutral-500">
      <span className="h-px flex-1 bg-white/10" />o
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}
