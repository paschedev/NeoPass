import type { ReactNode } from 'react';

// El marco de Ingresar y Registro: una columna angosta y centrada sobre el
// fondo liso (la barra de arriba lleva al inicio).
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
    <div className="min-h-screen bg-neutral-950 px-4 pt-6 pb-24 md:pb-12">
      <main className="mx-auto w-full max-w-sm pt-16 md:pt-24">
        <div className="text-center mb-8">
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
