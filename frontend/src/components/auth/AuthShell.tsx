import type { ReactNode } from 'react';
import Isologo from '@/components/brand/Isologo';
import { TelaInferior, TelaSuperior } from '@/components/brand/Telas';

// El marco de Ingresar y Registro: una columna angosta y centrada, con la N
// arriba del título y dos telas que entran por las esquinas (la barra de
// arriba lleva al inicio). Las telas quedan detrás y no tapan los campos: en
// el celular se corren hacia afuera.
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
    <div className="relative isolate overflow-clip min-h-screen bg-neutral-950 px-4 pt-6 pb-24 md:pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <TelaSuperior className="absolute top-[34px] -right-[38%] w-[125%] md:top-0 md:right-0 md:w-[56%] md:max-w-[1000px]" />
        <TelaInferior className="absolute -bottom-[2%] -left-[34%] w-[95%] md:bottom-0 md:left-0 md:w-[44%] md:max-w-[800px]" />
      </div>
      <main className="mx-auto w-full max-w-sm pt-16 md:pt-24">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 grid size-13 place-items-center rounded-2xl border border-white/12 bg-gradient-to-b from-[#19191f] to-[#0e0e12] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
            <Isologo className="h-6 w-auto" />
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
