import Link from 'next/link';
import { Ticket } from 'lucide-react';

export default function PresetsLinkSection() {
  return (
    <section className="p-6 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Ticket
            aria-hidden="true"
            className="w-5 h-5 shrink-0 text-neutral-400"
          />
          <div>
            <h2 className="text-lg font-bold text-white">
              Plantillas de entradas
            </h2>
            <p className="text-neutral-400 text-sm">
              Los tipos de entrada que usás seguido, para cargarlos rápido
            </p>
          </div>
        </div>
        <Link
          href="/panel/configuracion/presets"
          className="w-full sm:w-auto text-center bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Administrar plantillas
        </Link>
      </div>
    </section>
  );
}
